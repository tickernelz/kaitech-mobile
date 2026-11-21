type LiveKit = typeof import('@livekit/react-native');
type Client = typeof import('livekit-client');

let ready: LiveKit | null = null;
let registered = false;

export function liveKit(): LiveKit | null {
  return ready;
}

export function loadLiveKit(): Promise<LiveKit> {
  if (!ready) {
    const module = require('@livekit/react-native') as LiveKit;
    if (!registered) {
      module.registerGlobals();
      registered = true;
    }
    ready = module;
  }
  return Promise.resolve(ready);
}

export function loadClient(): Promise<Client> {
  return Promise.resolve(require('./liveKitClient') as Client);
}

export type LiveRoom = import('livekit-client').Room;
export type LiveParticipant = import('livekit-client').Participant;
