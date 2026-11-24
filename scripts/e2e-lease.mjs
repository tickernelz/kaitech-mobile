#!/usr/bin/env node
const server = (process.env.E2E_SERVER ?? '').replace(/\/$/, '');
const host = server.replace(/^https?:\/\//, '');
const missing = ['E2E_DB', 'E2E_LOGIN', 'E2E_PASSWORD'].filter((key) => !process.env[key]);
if (!host) missing.unshift('E2E_SERVER');
if (missing.length) throw new Error('missing ' + missing.join(', '));
const label = process.argv[2];
if (!label) throw new Error('usage: e2e-lease.mjs <label>');
const origin = /^https?:\/\//.test(server) ? server : 'https://' + host;
const waitLimitMs = Number(process.env.E2E_LEASE_WAIT_SECONDS ?? 1800) * 1000;
const renewMs = 60_000;
const downMs = 15_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const note = (line) => process.stderr.write('[e2e-lease] ' + line + '\n');

class Down extends Error {}

async function rpc(path, params, cookie) {
  let answer;
  try {
    answer = await fetch(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
    });
  } catch (error) {
    throw new Down(path + ': ' + error.message);
  }
  if (answer.status !== 200) throw new Down(path + ': HTTP ' + answer.status);
  const body = await answer.json();
  const match = /session_id=([^;]+)/.exec(answer.headers.get('set-cookie') ?? '');
  return { body, cookie: match ? 'session_id=' + match[1] : cookie };
}

let cookie = null;
let lease = false;
let stopping = false;

async function signIn() {
  const { body, cookie: signed } = await rpc('/web/session/authenticate', {
    db: process.env.E2E_DB,
    login: process.env.E2E_LOGIN,
    password: process.env.E2E_PASSWORD,
  });
  if (body.error || !body.result?.uid || !signed) throw new Error('the test account did not sign in: ' + (body.error?.data?.message ?? 'no session'));
  cookie = signed;
}

async function call(method, args) {
  if (!cookie) await signIn();
  const ask = () => rpc('/web/dataset/call_kw', { model: 'kaitech.mobile.e2e.lease', method, args, kwargs: {} }, cookie);
  let { body } = await ask();
  if (body.error && (body.error.code === 100 || /SessionExpired/.test(body.error.data?.name ?? ''))) {
    await signIn();
    ({ body } = await ask());
  }
  if (body.error) {
    const name = body.error.data?.name ?? '';
    const message = body.error.data?.message ?? body.error.message ?? 'failed';
    const error = new Error(method + ': ' + message);
    error.unknownModel = method === 'hold' && name === 'werkzeug.exceptions.NotFound';
    throw error;
  }
  return body.result;
}

async function take() {
  const deadline = Date.now() + waitLimitMs;
  let waiting = null;
  for (;;) {
    let answer;
    try {
      answer = await call('hold', [label, lease]);
    } catch (error) {
      if (!(error instanceof Down)) throw error;
      answer = { down: error.message };
    }
    if (answer.lease) return answer.lease;
    const reason = answer.down ? host + ' is not answering (' + answer.down + ')' : host + ' is draining for a deploy';
    if (reason !== waiting) note(reason + '; waiting before the flows start');
    waiting = reason;
    if (Date.now() >= deadline) throw new Error(host + ' gave no E2E lease within ' + waitLimitMs / 1000 + ' s: ' + reason);
    await sleep(answer.down ? downMs : answer.wait * 1000);
  }
}

async function stop() {
  if (stopping) return;
  stopping = true;
  if (lease) await call('release', [lease]).catch((error) => note('release failed, the lease ends on its own: ' + error.message));
  if (cookie) await rpc('/web/session/destroy', {}, cookie).catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.stdin.on('end', stop);
process.stdin.resume();

try {
  lease = await take();
} catch (error) {
  if (!error.unknownModel) {
    note(error.message);
    process.exit(1);
  }
  console.log('unleased');
  note('::warning::' + host + ' has no E2E lease model; the flows run without holding the server against a deploy');
  process.exit(0);
}
console.log('held ' + lease);
note('holding ' + host + ' as lease ' + lease + ' for ' + label);
for (;;) {
  await sleep(renewMs);
  if (stopping) break;
  try {
    const renewed = await call('hold', [label, lease]);
    if (renewed.lease) lease = renewed.lease;
    else note('::warning::lease ' + lease + ' ran out while ' + host + ' drains for a deploy; a deploy may stop the server under these flows');
  } catch (error) {
    note('renewal failed, trying again in ' + renewMs / 1000 + ' s: ' + error.message);
  }
}
