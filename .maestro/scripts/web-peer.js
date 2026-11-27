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

function sessionCookie(login, password) {
  var signed = rpc('/web/session/authenticate', { db: DB, login: login, password: password });
  var raw = signed.headers['Set-Cookie'] || signed.headers['set-cookie'] || '';
  var match = /session_id=([^;]+)/.exec(String(raw));
  if (!match) throw new Error('no session cookie');
  return 'session_id=' + match[1];
}

var asPhone = ACTION === 'conversation' || ACTION === 'conversationGone' || ACTION === 'tidy';
var cookie = asPhone ? sessionCookie(LOGIN, PASSWORD) : sessionCookie(WEB_LOGIN, WEB_PASSWORD);
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

function callKw(model, method, args, kwargs) {
  return rpc('/web/dataset/call_kw/' + model + '/' + method, { model: model, method: method, args: args, kwargs: kwargs || {} }, cookie).result;
}

function ownPartner() {
  return rpc('/web/session/get_session_info', {}, cookie).result.partner_id;
}

function otherMember(channelId) {
  var mine = ownPartner();
  var members = callKw('discuss.channel.member', 'search_read', [[['channel_id', '=', channelId]]], { fields: ['partner_id'] });
  for (var i = 0; i < members.length; i++) {
    var partner = members[i].partner_id && members[i].partner_id[0];
    if (partner && partner !== mine) return partner;
  }
  throw new Error('no other member in channel ' + channelId);
}

function say(channelId, text) {
  rpc(
    '/mail/message/post',
    { thread_model: 'discuss.channel', thread_id: channelId, post_data: { body: text, message_type: 'comment', subtype_xmlid: 'mail.mt_comment' } },
    cookie,
  );
}

if (ACTION === 'group') {
  var phone = otherMember(channel);
  var made = rpc('/mail/action', { fetch_params: [['/discuss/create_group', { partners_to: [phone], name: GROUP }]] }, cookie).result;
  var groups = (made['discuss.channel'] || []).filter(function (row) { return row.name === GROUP; });
  if (!groups.length) throw new Error('group not created');
  say(groups[0].id, GROUP + ' halo');
  output.peer = { group: groups[0].id, phone: phone };
}

if (ACTION === 'say') {
  say(Number(TARGET), RUN + ' kembali');
  output.peer = { said: Number(TARGET) };
}

if (ACTION === 'ring') {
  var joined = rpc('/mail/rtc/channel/join_call', { channel_id: channel, camera: false }, cookie).result;
  var rtc = joined.Rtc || joined.rtc || {};
  output.peer = { session: Number((rtc.localSession && rtc.localSession.id) || rtc.localSession || 0) };
}

if (ACTION === 'decline') {
  rpc('/mail/rtc/channel/cancel_call_invitation', { channel_id: channel }, cookie);
  output.peer = { declined: channel };
}

if (ACTION === 'hangUp') {
  rpc('/mail/rtc/channel/leave_call', { channel_id: channel }, cookie);
  output.peer = { left: channel };
}

if (ACTION === 'left') {
  var phonePartner = otherMember(channel);
  var still = callKw('discuss.channel.member', 'search_count', [[['channel_id', '=', Number(TARGET)], ['partner_id', '=', phonePartner]]]);
  if (still !== 0) throw new Error('phone is still a member of ' + TARGET);
  callKw('discuss.channel', 'action_unfollow', [[Number(TARGET)]]);
  output.peer = { left: Number(TARGET) };
}

if (ACTION === 'conversation') {
  var created = callKw('ck.conversation', 'create', [{ name: TITLE, engagement_id: Number(PROGRAMME) }]);
  output.peer = { conversation: Array.isArray(created) ? created[0] : created };
}

if (ACTION === 'conversationGone') {
  var left = callKw('ck.conversation', 'search_count', [[['id', '=', Number(TARGET)], ['active', 'in', [true, false]]]]);
  if (left !== 0) throw new Error('conversation ' + TARGET + ' still exists');
  output.peer = { gone: Number(TARGET) };
}

if (ACTION === 'tidy') {
  var me = rpc('/web/session/get_session_info', {}, cookie).result.uid;
  var hourAgo = new Date(Date.now() - 3600000).toISOString().replace('T', ' ').slice(0, 19);
  var stale = callKw('mail.activity', 'search', [[
    '&', ['user_id', '=', me],
    '|', ['create_date', '<', hourAgo],
    '|', ['summary', 'ilike', RUN],
    ['res_name', '=', 'Rekaman ' + RUN.slice(-6)],
  ]]);
  var kept = [];
  for (var t = 0; t < stale.length; t++) {
    try {
      callKw('mail.activity', 'action_feedback', [[stale[t]]], { feedback: 'e2e cleanup ' + RUN });
    } catch (error) {
      try {
        callKw('mail.activity', 'unlink', [[stale[t]]]);
      } catch (again) {
        kept.push(stale[t]);
      }
    }
  }
  if (kept.length) throw new Error('could not close activities ' + kept.join(','));
  var partner = rpc('/web/session/get_session_info', {}, cookie).result.partner_id;
  var memberships = callKw('discuss.channel.member', 'search_read', [[
    ['partner_id', '=', partner],
    ['channel_id.channel_type', '=', 'group'],
    '|', ['channel_id.name', 'ilike', RUN],
    '&', ['channel_id.name', 'ilike', 'E2E'], ['channel_id.create_date', '<', hourAgo],
  ]], { fields: ['channel_id'] });
  for (var g = 0; g < memberships.length; g++) callKw('discuss.channel', 'action_unfollow', [[memberships[g].channel_id[0]]]);
  output.peer = { tidied: stale.length, left: memberships.length };
}
