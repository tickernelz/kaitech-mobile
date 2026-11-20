import type { Participant, Room, Track } from 'livekit-client';

type LiveKit = typeof import('@livekit/react-native');
type Client = typeof import('livekit-client');

let livekit: Promise<LiveKit> | null = null;
let client: Promise<Client> | null = null;
let registered = false;

export function loadLiveKit(): Promise<LiveKit> {
  if (!livekit) {
    livekit = import('@livekit/react-native').then((module) => {
      if (!registered) {
        module.registerGlobals();
        registered = true;
      }
      ready = module;
      return module;
    });
  }
  return livekit;
}

let ready: LiveKit | null = null;

export function liveKit(): LiveKit | null {
  return ready;
}

export function loadClient(): Promise<Client> {
  if (!client) client = import('livekit-client');
  return client;
}

export type LiveRoom = Room;
export type LiveParticipant = Participant;
export type TrackSource = Track.Source;
