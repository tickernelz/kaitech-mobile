var port = typeof PEER_PORT === 'undefined' || !PEER_PORT ? '8765' : PEER_PORT;
var path = typeof PEER_ACTION === 'undefined' || !PEER_ACTION ? 'command' : PEER_ACTION;
var command = {};
if (typeof CAMERA !== 'undefined' && (CAMERA === 'on' || CAMERA === 'off')) command.camera = CAMERA === 'on';
if (typeof SHARE !== 'undefined' && (SHARE === 'on' || SHARE === 'off')) command.share = SHARE === 'on';
var answer;
try {
  answer = http.post('http://127.0.0.1:' + port + '/' + path, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
} catch (error) {
  throw new Error('call peer on ' + port + ' unreachable for ' + path + ': ' + error);
}
if (!answer.ok) throw new Error('call peer on ' + port + ' refused ' + path + ': ' + answer.status + ' ' + answer.body);
output.peer = path;
