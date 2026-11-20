#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readFileSync as read, rmSync, writeFileSync } from 'node:fs';
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
const state = { connected: false, participants: [], speakers: [], remoteAudio: 0, audioPlays: 0, error: null };
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
    tracks: [...p.trackPublications.values()].map((t) => t.kind + ':' + (t.source || '')),
  }));
  send();
}
async function start(call) {
  try {
    const room = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });
    globalThis.room = room;
    room.on(LivekitClient.RoomEvent.ParticipantConnected, () => { log('participant connected'); refresh(); });
    room.on(LivekitClient.RoomEvent.ParticipantDisconnected, () => { log('participant left'); refresh(); });
    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
      log('subscribed ' + track.kind + ' from ' + (track.participant && track.participant.identity));
      if (track.kind === 'audio') {
        const element = track.attach();
        element.autoplay = true;
        element.style.display = 'none';
        document.body.appendChild(element);
        element.play().then(() => { state.audioPlays += 1; send(); }).catch((error) => log('audio blocked: ' + error));
      }
      refresh();
    });
    room.on(LivekitClient.RoomEvent.TrackUnsubscribed, refresh);
    room.on(LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => { state.speakers = speakers.map((speaker) => speaker.identity); send(); });
    room.on(LivekitClient.RoomEvent.Disconnected, () => { state.connected = false; log('disconnected'); send(); });
    await room.connect(call.url, call.token);
    state.connected = true;
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
  const sessions = { cookie: '', sessionId: 0, state: null, ready: 0, logs: [], room: null };
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
        if (path === '/log') sessions.logs.push(body);
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
        try { process.kill(-process.pid, 'SIGKILL'); } catch { /* the group is gone */ }
        finish({ ok: true, pid: sessions.pid, port, sessionId: sessions.sessionId, logs: sessions.logs, state: sessions.state });
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

const actions = { serve, start, state, leave, stop };
const run = actions[action];
if (!run) {
  process.stderr.write('usage: call-peer.mjs ' + Object.keys(actions).join('|') + '\n');
  process.exit(2);
}
await run();
