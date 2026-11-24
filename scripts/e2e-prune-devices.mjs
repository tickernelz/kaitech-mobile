#!/usr/bin/env node
const host = (process.env.E2E_SERVER ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const missing = ['E2E_DB', 'E2E_LOGIN', 'E2E_PASSWORD'].filter((key) => !process.env[key]);
if (!host) missing.unshift('E2E_SERVER');
if (missing.length) throw new Error('missing ' + missing.join(', '));
const origin = 'https://' + host;
const hours = Number(process.env.E2E_DEVICE_IDLE_HOURS ?? 2);
const batch = 200;

async function rpc(path, params, cookie) {
  const answer = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
  });
  const body = await answer.json();
  if (body.error) throw new Error(path + ': ' + (body.error.data?.message ?? body.error.message ?? 'failed'));
  const match = /session_id=([^;]+)/.exec(answer.headers.get('set-cookie') ?? '');
  return { result: body.result, cookie: match ? 'session_id=' + match[1] : cookie };
}

function call(cookie, method, args, kwargs = {}) {
  return rpc('/web/dataset/call_kw', { model: 'kaitech.mobile.device', method, args, kwargs }, cookie).then((answer) => answer.result);
}

const session = await rpc('/web/session/authenticate', { db: process.env.E2E_DB, login: process.env.E2E_LOGIN, password: process.env.E2E_PASSWORD });
if (!session.cookie || !session.result?.uid) throw new Error('the test account did not sign in');
const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
const domain = [
  ['user_id', '=', session.result.uid],
  '|',
  ['last_used_at', '<', cutoff],
  '&',
  ['last_used_at', '=', false],
  ['create_date', '<', cutoff],
];
const ids = await call(session.cookie, 'search', [domain]);
for (let start = 0; start < ids.length; start += batch) {
  await call(session.cookie, 'action_revoke', [ids.slice(start, start + batch)]);
}
await rpc('/web/session/destroy', {}, session.cookie).catch(() => undefined);
console.log('revoked ' + ids.length + ' test-account devices idle for ' + hours + 'h');
