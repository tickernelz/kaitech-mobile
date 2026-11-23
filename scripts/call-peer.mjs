#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readFileSync as read, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';

const statePath = process.env.CALL_PEER_STATE ?? joinPath(tmpdir(), 'kaitech-call-peer.json');
const action = process.argv[2] ?? 'state';
const port = Number(process.env.CALL_PEER_PORT ?? 8765);

function config() {
  const host = (process.env.CALL_SERVER ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const missing = ['CALL_DB', 'CALL_LOGIN', 'CALL_PASSWORD', 'CALL_CHANNEL_ID'].filter((key) => !process.env[key]);
  if (!host) missing.unshift('CALL_SERVER');
  if (missing.length) throw new Error('missing ' + missing.join(', '));
  return {
    origin: 'https://' + host,
    db: process.env.CALL_DB,
    login: process.env.CALL_LOGIN,
    password: process.env.CALL_PASSWORD,
    channelId: Number(process.env.CALL_CHANNEL_ID),
    video: process.env.CALL_VIDEO !== '0',
    holdMs: Number(process.env.CALL_PEER_HOLD_MS ?? 0),
  };
}

function writeState(next) {
  writeFileSync(statePath, JSON.stringify(next, null, 2));
}

function readState() {
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function cookieOf(headers) {
  const raw = headers.get('set-cookie') ?? '';
  const match = /session_id=([^;]+)/.exec(raw);
  return match ? 'session_id=' + match[1] : '';
}

async function rpc(origin, path, params, cookie) {
  const answer = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
  });
  const body = await answer.json();
  if (body.error) throw new Error(path + ': ' + (body.error.data?.message ?? body.error.message ?? 'failed'));
  return { result: body.result, cookie: cookieOf(answer.headers) };
}

async function login(cfg) {
  const answer = await rpc(cfg.origin, '/web/session/authenticate', { db: cfg.db, login: cfg.login, password: cfg.password });
  if (!answer.cookie) throw new Error('no session cookie');
  return answer.cookie;
}

async function joinRoom(cfg, cookie) {
  const answer = await rpc(cfg.origin, '/mail/rtc/channel/join_call', { channel_id: cfg.channelId, camera: cfg.video }, cookie);
  const rtc = answer.result?.Rtc ?? answer.result?.rtc ?? {};
  const info = rtc.serverInfo ?? {};
  if (!info.url || !info.jsonWebToken) throw new Error('the call has no livekit room');
  return { url: info.url, token: info.jsonWebToken, sessionId: Number(rtc.localSession ?? 0) };
}

const page = [
  '<!doctype html><html><head><meta charset="utf-8"><title>call peer</title></head>',
  '<body style="font-family: sans-serif"><h1>Kaitech call peer</h1><pre id="log"></pre>',
  '<script src="/livekit-client.umd.js"></script><script src="/peer.js"></script>',
  '</body></html>',
].join('');

const peer = `
const out = document.getElementById('log');
const state = { connected: false, participants: [], speakers: [], remoteAudio: 0, audioPlays: 0, recording: false, screens: [], sharing: false, error: null };
const screens = new Map();
let shared = null;
const played = new Map();
function frames() {
  for (const [identity, element] of screens) {
    if (!element.videoWidth) continue;
    const canvas = document.createElement('canvas');
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext('2d').drawImage(element, 0, 0);
    fetch('/frame?from=' + encodeURIComponent(identity), { method: 'POST', body: canvas.toDataURL('image/png') }).catch(() => undefined);
  }
  state.screens = [...screens].map(([identity, element]) => {
    const total = element.getVideoPlaybackQuality ? element.getVideoPlaybackQuality().totalVideoFrames : 0;
    const fps = total - (played.get(identity) ?? total);
    played.set(identity, total);
    if (identity.endsWith('|camera') && element.videoWidth) log('fps ' + identity + ' ' + fps + ' ' + element.videoWidth + 'x' + element.videoHeight);
    return { identity, width: element.videoWidth, height: element.videoHeight, fps };
  });
}
async function share(on) {
  const room = globalThis.room;
  if (!room) return;
  if (on && !shared) {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const draw = canvas.getContext('2d');
    let tick = 0;
    setInterval(() => {
      tick += 1;
      draw.fillStyle = '#441D65';
      draw.fillRect(0, 0, 1280, 720);
      draw.fillStyle = '#FFFFFF';
      draw.font = 'bold 72px sans-serif';
      draw.fillText('Web screen share', 80, 200);
      draw.font = '48px sans-serif';
      draw.fillText(new Date().toISOString().slice(11, 19) + ' UTC  frame ' + tick, 80, 320);
      draw.fillStyle = '#F5B700';
      draw.fillRect(80 + ((tick * 20) % 1000), 420, 120, 120);
    }, 100);
    const track = canvas.captureStream(10).getVideoTracks()[0];
    shared = await room.localParticipant.publishTrack(track, { source: LivekitClient.Track.Source.ScreenShare, name: 'screen' });
    state.sharing = true;
    log('sharing a screen');
  }
  if (!on && shared) {
    await room.localParticipant.unpublishTrack(shared.track);
    shared = null;
    state.sharing = false;
    log('stopped sharing');
  }
  refresh();
}
setInterval(() => {
  fetch('/command').then((answer) => answer.json()).then((command) => {
    if (command && command.share !== undefined) share(command.share);
  }).catch(() => undefined);
  frames();
}, 1000);
function log(line) {
  out.textContent += line + '\\n';
  fetch('/log', { method: 'POST', body: String(line) }).catch(() => undefined);
}
function send() { fetch('/state', { method: 'POST', body: JSON.stringify(state) }).catch(() => undefined); }
function ready() { fetch('/ready', { method: 'POST', body: '1' }).catch(() => undefined); }
function refresh() {
  const room = globalThis.room;
  if (!room) return;
  state.participants = [...room.remoteParticipants.values()].map((p) => ({
    identity: p.identity,
    name: p.name,
    mic: p.isMicrophoneEnabled,
    camera: p.isCameraEnabled,
    attributes: { ...(p.attributes || {}) },
    tracks: [...p.trackPublications.values()].map((t) => t.kind + ':' + (t.source || '')),
  }));
  send();
}
async function start(call) {
  try {
    const room = new LivekitClient.Room({ adaptiveStream: false, dynacast: true });
    globalThis.room = room;
    room.on(LivekitClient.RoomEvent.ParticipantConnected, () => { log('participant connected'); refresh(); });
    room.on(LivekitClient.RoomEvent.ParticipantDisconnected, () => { log('participant left'); refresh(); });
    room.on(LivekitClient.RoomEvent.TrackMuted, (publication, participant) => { log('muted ' + publication.kind + ' from ' + (participant && participant.identity)); refresh(); });
    room.on(LivekitClient.RoomEvent.TrackUnmuted, (publication, participant) => { log('unmuted ' + publication.kind + ' from ' + (participant && participant.identity)); refresh(); });
    room.on(LivekitClient.RoomEvent.ParticipantAttributesChanged, (changed, participant) => { log('attributes from ' + (participant && participant.identity) + ' ' + JSON.stringify(changed)); refresh(); });
    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
      log('subscribed ' + track.kind + ' from ' + (track.participant && track.participant.identity));
      if (track.kind === 'video') {
        const element = track.attach();
        element.muted = true;
        element.style.width = '640px';
        document.body.appendChild(element);
        const camera = track.source !== 'screen_share';
        screens.set((track.participant ? track.participant.identity : 'unknown') + (camera ? '|camera' : ''), element);
        log((camera ? 'camera from ' : 'screen from ') + (track.participant && track.participant.identity));
      }
      if (track.kind === 'audio') {
        const element = track.attach();
        element.autoplay = true;
        element.style.display = 'none';
        document.body.appendChild(element);
        element.play().then(() => { state.audioPlays += 1; send(); }).catch((error) => log('audio blocked: ' + error));
      }
      refresh();
    });
    room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
      if (track.source === 'screen_share') {
        const identity = track.participant ? track.participant.identity : 'unknown';
        const element = screens.get(identity);
        if (element) element.remove();
        screens.delete(identity);
        log('screen ended from ' + identity);
      }
      refresh();
    });
    room.on(LivekitClient.RoomEvent.RecordingStatusChanged, (recording) => { state.recording = recording; log('recording ' + recording); send(); });
    room.on(LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => { state.speakers = speakers.map((speaker) => speaker.identity); send(); });
    room.on(LivekitClient.RoomEvent.Disconnected, () => { state.connected = false; log('disconnected'); send(); });
    await room.connect(call.url, call.token);
    state.connected = true;
    state.recording = room.isRecording;
    await room.localParticipant.setMicrophoneEnabled(true);
    if (call.video) await room.localParticipant.setCameraEnabled(true);
    log('connected as ' + room.localParticipant.identity + ' in ' + room.name);
    refresh();
    setInterval(() => {
      const audio = [...room.remoteParticipants.values()]
        .flatMap((p) => [...p.trackPublications.values()])
        .filter((t) => t.kind === 'audio' && t.isSubscribed);
      state.remoteAudio = audio.length;
      send();
    }, 2000);
  } catch (error) {
    state.error = String(error);
    log('failed: ' + error);
  }
  ready();
}
fetch('/call').then((answer) => answer.json()).then(start).catch((error) => { state.error = String(error); log('no call: ' + error); ready(); });
`;

function serve() {
  const cfg = config();
  const sessions = { cookie: '', sessionId: 0, state: null, ready: 0, logs: [], room: null, command: {} };
  const framesDir = process.env.CALL_PEER_FRAMES ?? '';
  let frameCount = 0;
  if (framesDir) mkdirSync(framesDir, { recursive: true });
  const chromeDir = mkdtempSync(joinPath(tmpdir(), 'kaitech-call-peer-'));
  let chrome = null;
  let finished = false;

  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (request.method === 'POST') {
      let body = '';
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        if (path === '/state') {
          try { sessions.state = JSON.parse(body); } catch { sessions.state = null; }
        }
        if (path === '/log') sessions.logs.push(new Date().toISOString() + ' ' + body);
        if (path === '/frame' && framesDir && body.startsWith('data:image/png;base64,')) {
          frameCount += 1;
          writeFileSync(joinPath(framesDir, 'screen-' + String(frameCount).padStart(4, '0') + '.png'), Buffer.from(body.slice(22), 'base64'));
        }
        if (path === '/command') {
          try { sessions.command = JSON.parse(body); } catch { sessions.command = {}; }
        }
        if (path === '/ready') sessions.ready = 1;
        response.end('ok');
      });
      return;
    }
    if (path === '/call') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(sessions.room));
      return;
    }
    if (path === '/state') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(sessions.state));
      return;
    }
    if (path === '/logs') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(sessions.logs));
      return;
    }
    if (path === '/command') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(sessions.command));
      return;
    }
    if (path === '/livekit-client.umd.js') {
      response.setHeader('content-type', 'text/javascript');
      response.end(read(joinPath(process.cwd(), 'node_modules/livekit-client/dist/livekit-client.umd.js')));
      return;
    }
    if (path === '/peer.js') {
      response.setHeader('content-type', 'text/javascript');
      response.end(peer);
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end(page);
  });
  server.listen(port, '127.0.0.1');

  const finish = (payload) => {
    if (finished) return;
    finished = true;
    writeState(payload);
    setTimeout(() => {
      try { chrome.kill('SIGKILL'); } catch { /* already gone */ }
      try { rmSync(chromeDir, { recursive: true, force: true }); } catch { /* already gone */ }
      server.close();
    }, 300);
  };

  const failed = (error) => finish({ ok: false, pid: sessions.pid, error: String(error), logs: sessions.logs, state: sessions.state });

  (async () => {
    sessions.pid = process.pid;
    sessions.cookie = await login(cfg);
    sessions.room = await joinRoom(cfg, sessions.cookie);
    sessions.sessionId = sessions.room.sessionId;
    setInterval(() => {
      rpc(cfg.origin, '/discuss/channel/ping', { channel_id: cfg.channelId, rtc_session_id: sessions.sessionId, check_rtc_session_ids: [] }, sessions.cookie).catch(() => undefined);
    }, 20_000);
    const binary = process.env.CHROME_BIN ?? 'google-chrome';
    chrome = spawn(binary, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=' + chromeDir,
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      'http://127.0.0.1:' + port + '/',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    chrome.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    chrome.on('exit', (code) => {
      if (sessions.ready === 0) failed('chrome exited ' + code + ': ' + stderr.slice(-400));
    });
    writeState({ ok: null, pid: sessions.pid, port, room: sessions.room.url, sessionId: sessions.sessionId });
    const limit = Date.now() + 60_000;
    const timer = setInterval(() => {
      const peerState = sessions.state;
      if (sessions.ready && peerState && peerState.connected) {
        clearInterval(timer);
        const report = { ok: true, pid: sessions.pid, port, sessionId: sessions.sessionId, logs: sessions.logs, state: peerState };
        if (cfg.holdMs === 0) {
          finish(report);
          return;
        }
        writeState(report);
        return;
      }
      if (sessions.ready && peerState && peerState.error) {
        clearInterval(timer);
        failed(peerState.error);
        return;
      }
      if (Date.now() > limit) {
        clearInterval(timer);
        failed('the peer did not connect in 60s: ' + JSON.stringify(peerState));
      }
    }, 250);
  })().catch(failed);

  process.on('SIGTERM', () => {
    rpc(cfg.origin, '/mail/rtc/channel/leave_call', { channel_id: cfg.channelId, session_id: sessions.sessionId }, sessions.cookie)
      .catch(() => undefined)
      .finally(() => {
        writeState({ ok: true, pid: sessions.pid, port, sessionId: sessions.sessionId, logs: sessions.logs, state: sessions.state });
        try { process.kill(-process.pid, 'SIGKILL'); } catch { /* the group is gone */ }
      });
  });
}

async function start() {
  const previous = readState();
  if (previous?.pid) throw new Error('the peer is already running as ' + previous.pid);
  writeState({ ok: null, pid: 0, startedAt: Date.now() });
  const child = spawn(process.execPath, [new URL(import.meta.url).pathname, 'serve'], { detached: true, stdio: 'ignore', env: process.env });
  child.unref();
  writeState({ ok: null, pid: child.pid, startedAt: Date.now(), port });
  const limit = Date.now() + 90_000;
  while (Date.now() < limit) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const current = readState();
    if (current?.pid !== child.pid) continue;
    if (current.ok === true) {
      console.log(JSON.stringify(current, null, 2));
      return;
    }
    if (current.ok === false) throw new Error(current.error);
  }
  throw new Error('the peer did not report in 90s');
}

async function state() {
  const current = readState();
  console.log(JSON.stringify({ running: Boolean(current && current.pid), store: current }, null, 2));
}

async function leave() {
  const current = readState();
  if (!current?.pid) return;
  try { process.kill(current.pid, 'SIGTERM'); } catch { /* already gone */ }
  const limit = Date.now() + 20_000;
  while (Date.now() < limit) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const next = readState();
    if (next?.ok === true || next?.ok === false) {
      console.log(JSON.stringify(next, null, 2));
      return;
    }
  }
  throw new Error('the peer did not report its leave in 20s');
}

async function stop() {
  const current = readState();
  if (current?.pid) {
    try { process.kill(current.pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  rmSync(statePath, { force: true });
}

async function screen() {
  const current = readState();
  if (!current?.port) throw new Error('the peer is not running');
  const on = process.argv[3] === 'on';
  await fetch('http://127.0.0.1:' + current.port + '/command', { method: 'POST', body: JSON.stringify({ share: on }) });
  console.log(JSON.stringify({ share: on }));
}

async function live() {
  const current = readState();
  if (!current?.port) throw new Error('the peer is not running');
  const answer = await fetch('http://127.0.0.1:' + current.port + '/state');
  console.log(JSON.stringify(await answer.json(), null, 2));
}

async function logs() {
  const current = readState();
  if (!current?.port) throw new Error('the peer is not running');
  const answer = await fetch('http://127.0.0.1:' + current.port + '/logs');
  console.log(JSON.stringify(await answer.json(), null, 2));
}

const actions = { serve, start, state, leave, stop, screen, live, logs };
const run = actions[action];
if (!run) {
  process.stderr.write('usage: call-peer.mjs ' + Object.keys(actions).join('|') + '\n');
  process.exit(2);
}
await run();
