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

function sessionCookie() {
  var signed = rpc('/web/session/authenticate', { db: DB, login: WEB_LOGIN, password: WEB_PASSWORD });
  var raw = signed.headers['Set-Cookie'] || signed.headers['set-cookie'] || '';
  var match = /session_id=([^;]+)/.exec(String(raw));
  if (!match) throw new Error('no session cookie');
  return 'session_id=' + match[1];
}

var cookie = sessionCookie();
var channel = Number(CHANNEL_ID);

if (ACTION === 'read') {
  var page = rpc('/discuss/channel/messages', { channel_id: channel, fetch_params: { limit: 1 } }, cookie).result;
  var newest = page.messages[0];
  rpc('/discuss/channel/mark_as_read', { channel_id: channel, last_message_id: newest }, cookie);
  output.peer = { read: newest };
}

if (ACTION === 'count') {
  var found = rpc('/discuss/channel/messages', { channel_id: channel, fetch_params: { search_term: RUN, limit: 100 } }, cookie).result;
  var store = found.data['mail.message'] || [];
  var seen = {};
  for (var i = 0; i < store.length; i++) {
    var body = store[i].body;
    var html = Array.isArray(body) ? body[1] : String(body || '');
    var match = new RegExp(RUN + ' (m\\d+)').exec(html);
    if (match) seen[match[1]] = (seen[match[1]] || 0) + 1;
  }
  var problems = [];
  for (var n = 1; n <= Number(EXPECTED); n++) {
    if (seen['m' + n] !== 1) problems.push('m' + n + '=' + (seen['m' + n] || 0));
  }
  if (store.length !== Number(EXPECTED) || problems.length) throw new Error('not exactly once: total ' + store.length + ' ' + problems.join(','));
  output.peer = { delivered: store.length };
}

if (ACTION === 'voice') {
  var html = http.get(base + '/odoo', { headers: { Cookie: cookie } }).body;
  var csrf = /csrf_token: "([0-9a-f]+o?[0-9]*)"/.exec(html);
  if (!csrf) throw new Error('no csrf token');
  var uploaded = http.post(base + '/mail/attachment/upload', {
    headers: { Cookie: cookie },
    multipartForm: {
      ufile: { filePath: '../assets/voice-web.mp3', mediaType: 'audio/mpeg' },
      thread_id: String(channel),
      thread_model: 'discuss.channel',
      is_pending: 'true',
      voice: 'true',
      csrf_token: csrf[1],
    },
  });
  var data = json(uploaded.body).data;
  if (!uploaded.ok || !data) throw new Error('upload failed: ' + uploaded.status);
  rpc(
    '/mail/message/post',
    {
      thread_model: 'discuss.channel',
      thread_id: channel,
      post_data: {
        body: '',
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment',
        attachment_ids: [data.attachment_id],
        attachment_tokens: [data.ownership_token || ''],
      },
    },
    cookie,
  );
  output.peer = { voice: data.attachment_id };
}
