var base = 'https://' + SERVER;

function rpc(path, params, cookie) {
  var answer = http.post(base + path, {
    headers: { 'Content-Type': 'application/json', Cookie: cookie || '' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params: params }),
  });
  var body = json(answer.body);
  if (!answer.ok || body.error) throw new Error(path + ' failed: ' + answer.status + ' ' + JSON.stringify(body.error || {}).slice(0, 200));
  return { result: body.result, headers: answer.headers };
}

var signed = rpc('/web/session/authenticate', { db: DB, login: WEB_LOGIN, password: WEB_PASSWORD });
var raw = signed.headers['Set-Cookie'] || signed.headers['set-cookie'] || '';
var match = /session_id=([^;]+)/.exec(String(raw));
if (!match) throw new Error('no session cookie');
var cookie = 'session_id=' + match[1];

function search(term) {
  var found = rpc('/discuss/channel/messages', { channel_id: Number(CHANNEL_ID), fetch_params: { search_term: term, limit: 20 } }, cookie).result;
  return found.data['mail.message'] || [];
}

function html(message) {
  return Array.isArray(message.body) ? message.body[1] : String(message.body || '');
}

var edited = search(RUN + ' a1 edited').filter(function (message) {
  return html(message).indexOf('o-mail-Message-edited') >= 0;
});
var all = rpc('/discuss/channel/messages', { channel_id: Number(CHANNEL_ID), fetch_params: { limit: 30 } }, cookie).result.data;
var reactions = (all['mail.message.reaction'] || []).filter(function (reaction) {
  return reaction.content === '\u{1F680}';
});
var mine = (all['mail.message'] || []).filter(function (message) {
  return edited.length && message.id === edited[0].id;
});
var removed = (all['mail.message'] || []).filter(function (message) {
  return message.message_type === 'comment' && !html(message).replace(/<[^>]*>/g, '').trim() && !(message.attachment_ids || []).length;
});
var forwarded = rpc('/web/dataset/call_kw/mail.message/search_count', {
  model: 'mail.message',
  method: 'search_count',
  args: [[['body', 'ilike', RUN + ' a1 edited'], ['model', '=', 'discuss.channel'], ['res_id', '!=', Number(CHANNEL_ID)]]],
  kwargs: {},
}, cookie).result;

output.actions = {
  edited: edited.length,
  pinned: mine.length && mine[0].pinned_at ? 1 : 0,
  reacted: reactions.length ? 1 : 0,
  removed: removed.length ? 1 : 0,
  forwarded: forwarded > 0 ? 1 : 0,
};
