var answer = http.post('http://127.0.0.1:8765/command', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ camera: CAMERA === 'on' }),
});
if (!answer.ok) throw new Error('the call peer did not take the camera command: ' + answer.status);
output.peerCamera = CAMERA;
