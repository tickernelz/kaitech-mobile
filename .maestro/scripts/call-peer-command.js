var port = typeof PEER_PORT === 'undefined' || !PEER_PORT ? '8765' : PEER_PORT;
var path = typeof PEER_ACTION === 'undefined' || !PEER_ACTION ? 'command' : PEER_ACTION;
var base = 'http://127.0.0.1:' + port;
var command = {};
if (typeof CAMERA !== 'undefined' && (CAMERA === 'on' || CAMERA === 'off')) command.camera = CAMERA === 'on';
if (typeof SHARE !== 'undefined' && (SHARE === 'on' || SHARE === 'off')) command.share = SHARE === 'on';
var answer;
try {
  answer = http.post(base + '/' + path, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
} catch (error) {
  throw new Error('call peer on ' + port + ' unreachable for ' + path + ': ' + error);
}
if (!answer.ok) throw new Error('call peer on ' + port + ' refused ' + path + ': ' + answer.status + ' ' + answer.body);
if (path === 'join') {
  var deadline = Date.now() + 30000;
  var state = null;
  while (Date.now() < deadline) {
    state = JSON.parse(http.get(base + '/state').body || 'null');
    if (state && (state.connected || state.error)) break;
  }
  if (!state || !state.connected) throw new Error('call peer on ' + port + ' did not connect in 30 s: ' + JSON.stringify(state));
}
output.peer = path;
