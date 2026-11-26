import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const pkg = 'io.kaitech.mobile';
const [kind, countArg, out] = process.argv.slice(2);
const kinds = ['message', 'call', 'activity', 'watch'];
const states = ['foreground', 'background', 'stopped', 'swiped', 'none'];
const state = process.env.PUSH_STATE ?? 'background';
const count = Number(countArg ?? 5);
const waitMs = Number(process.env.PUSH_WAIT_MS ?? 60000);
const gapMs = Number(process.env.PUSH_GAP_MS ?? 4000);
const ringMs = Number(process.env.PUSH_RING_MS ?? 5000);

function usage(problem) {
  console.error(problem);
  console.error('usage: PUSH_STATE=<' + states.join('|') + '> node scripts/push-latency.mjs <' + kinds.join('|') + '> <count> [out.tsv]');
  process.exit(2);
}

if (!kinds.includes(kind)) usage('unknown kind ' + kind);
if (!states.includes(state)) usage('unknown PUSH_STATE ' + state);
if (!Number.isInteger(count) || count < 1) usage('count must be a whole number from 1');
const needed = kind === 'watch' ? ['ANDROID_SERIAL', 'PUSH_SINCE_MS'] : ['ANDROID_SERIAL', 'E2E_SERVER', 'E2E_DB', 'E2E_WEB_LOGIN', 'E2E_WEB_PASSWORD', ...(kind === 'activity' ? ['E2E_PHONE_UID'] : ['E2E_CHANNEL_ID'])];
const missing = needed.filter((key) => !process.env[key]);
if (missing.length) usage('missing ' + missing.join(', '));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const adb = (...args) => execFileSync('adb', ['-s', process.env.ANDROID_SERIAL, ...args], { encoding: 'utf8', timeout: 30000 });
const shell = (command) => adb('shell', command).trim();

async function rpc(path, params, cookie) {
  const answer = await fetch('https://' + process.env.E2E_SERVER + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
  });
  const body = await answer.json();
  if (!answer.ok || body.error) throw new Error(path + ' failed: ' + answer.status + ' ' + JSON.stringify(body.error ?? {}).slice(0, 300));
  return { result: body.result, cookie: /session_id=([^;]+)/.exec(answer.headers.get('set-cookie') ?? '')?.[1] };
}

function phoneOffsetMs() {
  let best = null;
  for (let i = 0; i < 7; i += 1) {
    const before = Date.now();
    const phone = Number(shell('date +%s%N')) / 1e6;
    const after = Date.now();
    const sample = { rtt: after - before, offset: phone - (before + after) / 2 };
    if (!best || sample.rtt < best.rtt) best = sample;
  }
  return best;
}

function processState() {
  const pid = shell('pidof ' + pkg + ' || true');
  const stopped = /stopped=true/.test(shell('dumpsys package ' + pkg + ' | grep "stopped="'));
  return (pid ? 'alive' : 'dead') + (stopped ? '+stopped' : '');
}

async function prepare() {
  if (state === 'none') return;
  if (state === 'stopped') {
    shell('am force-stop ' + pkg);
    await sleep(1500);
    return;
  }
  shell('am start -W -n ' + pkg + '/.MainActivity');
  await sleep(3000);
  if (state === 'foreground') return;
  shell('input keyevent KEYCODE_HOME');
  await sleep(1500);
  if (state === 'swiped') {
    const [w, h] = shell('wm size').match(/(\d+)x(\d+)/).slice(1).map(Number);
    for (let attempt = 0; attempt < 3 && shell('pidof ' + pkg + ' || true'); attempt += 1) {
      shell('input keyevent KEYCODE_APP_SWITCH');
      await sleep(1500);
      shell('input swipe ' + Math.round(w / 2) + ' ' + Math.round(h * 0.55) + ' ' + Math.round(w / 2) + ' ' + Math.round(h * 0.08) + ' 250');
      await sleep(1500);
      shell('input keyevent KEYCODE_HOME');
      await sleep(3000);
    }
  }
}

function watch(sinceSeconds) {
  const lines = [];
  const child = spawn('adb', ['-s', process.env.ANDROID_SERIAL, 'logcat', '-b', 'events', '-b', 'main', '-b', 'system', '-v', 'epoch', '-T', sinceSeconds.toFixed(3)]);
  let rest = '';
  const waiters = [];
  child.stdout.on('data', (chunk) => {
    const text = rest + chunk.toString();
    const parts = text.split('\n');
    rest = parts.pop();
    for (const line of parts) {
      lines.push(line);
      for (const waiter of [...waiters]) if (waiter.test(line)) waiter.done(line);
    }
  });
  return {
    lines,
    until(test, ms) {
      const hit = lines.find(test);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve) => {
        const waiter = { test, done: (line) => { clearTimeout(timer); waiters.splice(waiters.indexOf(waiter), 1); resolve(line); } };
        const timer = setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); resolve(null); }, ms);
        waiters.push(waiter);
      });
    },
    stop() { child.kill(); },
  };
}

const enqueued = (line) => /notification_enqueue: \[\d+,\d+,io\.kaitech\.mobile,/.test(line) && (kind !== 'call' || /channel=kaitech_calls_ringing/.test(line));
const canceled = (line) => /notification_canceled: \[0\|io\.kaitech\.mobile\|/.test(line);
const stampOf = (line) => Number(line.trim().split(/\s+/)[0]) * 1000;

const web = kind === 'watch' ? null : await rpc('/web/session/authenticate', { db: process.env.E2E_DB, login: process.env.E2E_WEB_LOGIN, password: process.env.E2E_WEB_PASSWORD });
if (web && !web.cookie) throw new Error('no session cookie for the web account');
const cookie = web ? 'session_id=' + web.cookie : '';
const webPartner = web?.result.partner_id;
const channel = Number(process.env.E2E_CHANNEL_ID ?? 0);

async function send(trial) {
  const stamp = 'P' + Date.now().toString(36) + '-' + trial;
  if (kind === 'watch') return { stamp, after: async () => undefined };
  if (kind === 'message') {
    await rpc('/mail/message/post', { thread_model: 'discuss.channel', thread_id: channel, post_data: { body: 'push ' + stamp, message_type: 'comment', subtype_xmlid: 'mail.mt_comment' } }, cookie);
    return { stamp, after: async () => undefined };
  }
  if (kind === 'call') {
    const joined = await rpc('/mail/rtc/channel/join_call', { channel_id: channel, camera: false }, cookie);
    const rtc = joined.result?.Rtc ?? joined.result?.rtc ?? {};
    const session = Number(rtc.localSession ?? rtc.selfSession ?? 0);
    return { stamp, after: async () => rpc('/mail/rtc/channel/leave_call', { channel_id: channel, ...(session ? { session_id: session } : {}) }, cookie) };
  }
  const created = await rpc('/web/dataset/call_kw/res.partner/activity_schedule', {
    model: 'res.partner',
    method: 'activity_schedule',
    args: [[webPartner]],
    kwargs: { act_type_xmlid: 'mail.mail_activity_data_todo', summary: 'push ' + stamp, user_id: Number(process.env.E2E_PHONE_UID) },
  }, cookie);
  const ids = (Array.isArray(created.result) ? created.result : [created.result]).flat().map((row) => (typeof row === 'object' ? row.id : row)).filter(Boolean);
  return { stamp, after: async () => rpc('/web/dataset/call_kw/mail.activity/unlink', { model: 'mail.activity', method: 'unlink', args: [ids], kwargs: {} }, cookie).catch((error) => console.error('activity ' + ids + ' left: ' + error.message)) };
}

const rows = [];
for (let trial = 1; trial <= count; trial += 1) {
  if (kind !== 'watch') await prepare();
  const before = processState();
  const clock = phoneOffsetMs();
  const since = kind === 'watch' ? Number(process.env.PUSH_SINCE_MS) : Date.now();
  const log = watch((since + clock.offset) / 1000 - 0.5);
  if (kind !== 'watch') await sleep(800);
  const sentAt = kind === 'watch' ? since : Date.now();
  const sent = await send(trial);
  const posted = Date.now();
  const hit = await log.until(enqueued, waitMs);
  const latency = hit ? (stampOf(hit) - clock.offset - sentAt) / 1000 : null;
  let ringEnd = '';
  const leftAt = Date.now();
  await sent.after();
  if (kind === 'call' && hit) {
    const end = await log.until((line) => canceled(line) && stampOf(line) > stampOf(hit), ringMs + 15000);
    ringEnd = end ? ((stampOf(end) - clock.offset - leftAt) / 1000).toFixed(2) : 'still ringing';
  }
  const dropped = log.lines.find((line) => /result=CANCELLED/.test(line) && /io\.kaitech\.mobile|GCM|FirebaseMessaging|google/.test(line));
  log.stop();
  const row = [kind, state, trial, new Date(sentAt).toISOString(), ((posted - sentAt) / 1000).toFixed(2), latency === null ? 'none' : latency.toFixed(2), before, processState(), clock.rtt, ringEnd, dropped ? 'fcm-cancelled' : '', sent.stamp];
  rows.push(row);
  const text = row.join('\t');
  console.log(text);
  if (out) appendFileSync(out, text + '\n');
  await sleep(gapMs);
}
const got = rows.map((row) => row[5]).filter((value) => value !== 'none').map(Number).sort((a, b) => a - b);
const median = got.length ? got[Math.floor((got.length - 1) / 2)] : null;
console.log(kind + ' ' + state + ': ' + got.length + '/' + rows.length + ' delivered' + (got.length ? ', median ' + median.toFixed(2) + ' s, max ' + got[got.length - 1].toFixed(2) + ' s' : ''));
