import { screenOffNearEar, type ProximityInput } from '../src/features/call/proximity';

const mockScreenOff: boolean[] = [];
const mockRooms: MockRoom[] = [];
const mockNative = { proximity: true as boolean, route: 'earpiece' as string, routeFails: false };

type Handler = () => void;

class MockRemote {
  sid: string;
  identity: string;
  name: string;
  attributes: Record<string, string> = {};
  isCameraEnabled = false;
  isMicrophoneEnabled = true;
  isScreenShareEnabled = false;
  trackPublications = new Map();
  audioTrackPublications = new Map();
  constructor(sid: string, identity: string) {
    this.sid = sid;
    this.identity = identity;
    this.name = sid;
  }
  setVolume() {
    return undefined;
  }
}

class MockLocal {
  isScreenShareEnabled = false;
  isCameraEnabled = false;
  isMicrophoneEnabled = false;
  trackPublications = new Map();
  sid = 'local';
  identity = 'local';
  name = 'Me';
  attributes: Record<string, string> = {};
  setMicrophoneEnabled(on: boolean) {
    this.isMicrophoneEnabled = on;
    return Promise.resolve();
  }
  setCameraEnabled(on: boolean) {
    this.isCameraEnabled = on;
    return Promise.resolve();
  }
  setScreenShareEnabled(on: boolean) {
    this.isScreenShareEnabled = on;
    return Promise.resolve();
  }
  setAttributes(next: Record<string, string>) {
    this.attributes = next;
    return Promise.resolve();
  }
}

class MockRoom {
  handlers = new Map<string, Handler[]>();
  localParticipant = new MockLocal();
  remoteParticipants = new Map<string, MockRemote>();
  activeSpeakers = [];
  isRecording = false;
  constructor() {
    mockRooms.push(this);
  }
  on(name: string, handler: Handler) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
  }
  emit(name: string) {
    for (const handler of this.handlers.get(name) ?? []) handler();
  }
  connect() {
    return Promise.resolve();
  }
  disconnect() {
    return Promise.resolve();
  }
}

jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: () => null,
  setItemSync: () => undefined,
  removeItemSync: () => undefined,
}));
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireOptionalNativeModule: (name: string) =>
    name === 'KaitechProximity' && mockNative.proximity
      ? {
          audioRoute: () => {
            if (mockNative.routeFails) throw new Error('no audio manager');
            return mockNative.route;
          },
          setScreenOff: (enabled: boolean) => {
            mockScreenOff.push(enabled);
            return Promise.resolve(enabled);
          },
          addListener: () => ({ remove: () => undefined }),
        }
      : null,
}));
jest.mock('../src/i18n', () => ({ __esModule: true, default: { t: (key: string) => key, language: 'en' } }));
jest.mock('../src/auth/session', () => ({
  getSession: () => ({ accounts: [{ id: 'A', origin: 'https://a.test', db: 'dbA', userId: 1, partnerId: 11 }], activeId: 'A' }),
  onAccountForgotten: () => undefined,
}));
jest.mock('../src/features/call/api', () => ({
  CallClient: class {
    account: { id: string };
    constructor(account: { id: string }) {
      this.account = account;
    }
    join(channelId: number) {
      return Promise.resolve({ sessionId: 9, channelId, url: 'wss://room.test', token: 't' });
    }
    update() {
      return Promise.resolve();
    }
    ping() {
      return Promise.resolve({});
    }
    leave() {
      return Promise.resolve();
    }
    invitations() {
      return Promise.resolve({});
    }
  },
}));
jest.mock('../src/features/call/native', () => ({
  callNative: () => ({
    takePending: () => Promise.resolve([]),
    takeLaunchAction: () => Promise.resolve(null),
    cancelRing: () => Promise.resolve(true),
    setInCall: () => Promise.resolve(true),
    startCall: () => Promise.resolve(true),
    stopCall: () => Promise.resolve(true),
    updateCall: () => Promise.resolve(true),
    setCallSurface: () => Promise.resolve(true),
    setPictureInPicture: () => Promise.resolve(true),
    leavePictureInPicture: () => Promise.resolve(true),
    isInPictureInPicture: () => false,
    isResumed: () => true,
  }),
  onCallAction: () => () => undefined,
}));
jest.mock('../src/features/call/livekit', () => ({
  loadClient: () =>
    Promise.resolve({
      Room: MockRoom,
      RoomEvent: {
        ParticipantConnected: 'participantConnected',
        ParticipantDisconnected: 'participantDisconnected',
        ParticipantAttributesChanged: 'participantAttributesChanged',
        TrackSubscribed: 'trackSubscribed',
        TrackUnsubscribed: 'trackUnsubscribed',
        TrackMuted: 'trackMuted',
        TrackUnmuted: 'trackUnmuted',
        LocalTrackPublished: 'localTrackPublished',
        LocalTrackUnpublished: 'localTrackUnpublished',
        ActiveSpeakersChanged: 'activeSpeakersChanged',
        RecordingStatusChanged: 'recordingStatusChanged',
        Reconnecting: 'reconnecting',
        Reconnected: 'reconnected',
        Disconnected: 'disconnected',
      },
    }),
  loadLiveKit: () =>
    Promise.resolve({
      AudioSession: {
        startAudioSession: () => Promise.resolve(),
        stopAudioSession: () => Promise.resolve(),
        getAudioOutputs: () => Promise.resolve(['speaker', 'earpiece']),
        selectAudioOutput: () => Promise.resolve(),
      },
    }),
}));
jest.mock('../src/features/call/screenShare', () => ({ pickBroadcast: () => Promise.resolve(true) }));
jest.mock('../src/features/call/recording', () => ({
  startRecording: () => Promise.resolve(null),
  stopRecording: () => Promise.resolve(null),
  currentRecording: () => Promise.resolve(null),
}));
jest.mock('../src/features/call/permissions', () => ({ ensureMicrophone: () => Promise.resolve(true), ensureCamera: () => Promise.resolve(true) }));
jest.mock('../src/features/call/volumes', () => ({ loadVolumes: () => Promise.resolve(new Map()), saveVolume: () => Promise.resolve() }));
jest.mock('../src/features/chat/chat', () => ({
  conversationById: () => ({ id: 5, type: 'chat', partnerId: 77 }),
  getChat: () => ({ threads: {}, conversations: [] }),
  invitedChannels: () => [],
}));

const voice: ProximityInput = {
  phase: 'active',
  cameraOn: false,
  screenSharing: false,
  people: [
    { cameraOn: false, screenOn: false },
    { cameraOn: false, screenOn: false },
  ],
  speaker: false,
  route: 'earpiece',
  onCallScreen: true,
  inApp: true,
  pictureInPicture: false,
};

describe('when the screen turns off at the ear', () => {
  it('turns off in a voice call on the earpiece, also through a reconnect', () => {
    expect(screenOffNearEar(voice)).toBe(true);
    expect(screenOffNearEar({ ...voice, phase: 'reconnecting' })).toBe(true);
    expect(screenOffNearEar({ ...voice, people: [voice.people[0], voice.people[1], { cameraOn: false, screenOn: false }] })).toBe(true);
  });

  it.each<[string, Partial<ProximityInput>]>([
    ['your camera is on', { cameraOn: true }],
    ['you share your screen', { screenSharing: true }],
    ['someone else turns a camera on', { people: [voice.people[0], { cameraOn: true, screenOn: false }] }],
    ['someone else shares a screen', { people: [voice.people[0], { cameraOn: false, screenOn: true }] }],
    ['the speaker is chosen', { speaker: true }],
    ['the speaker is the route', { route: 'speaker' }],
    ['a Bluetooth headset is the route', { route: 'bluetooth' }],
    ['a wired headset is the route', { route: 'headset' }],
    ['the route is another device', { route: 'other' }],
    ['the route is unknown', { route: 'unknown' }],
    ['the call is ringing', { phase: 'incoming' }],
    ['the call is being placed', { phase: 'outgoing' }],
    ['the call is connecting', { phase: 'connecting' }],
    ['the call has ended', { phase: 'ended' }],
    ['there is no call', { phase: 'idle' }],
    ['the call is in picture-in-picture', { pictureInPicture: true }],
    ['the app is in the background', { inApp: false }],
    ['another screen is open', { onCallScreen: false }],
  ])('stays on when %s', (_reason, change) => {
    expect(screenOffNearEar({ ...voice, ...change })).toBe(false);
  });
});

async function flush() {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
}

async function activeCall() {
  const call = require('../src/features/call/call') as typeof import('../src/features/call/call');
  await call.startCall({ channelId: 5, channelName: 'Team' });
  await flush();
  expect(call.callState().phase).toBe('active');
  const room = mockRooms[mockRooms.length - 1];
  const peer = new MockRemote('PA', '31');
  room.remoteParticipants.set(peer.sid, peer);
  room.emit('participantConnected');
  call.setCallSurface(true);
  return { call, room, peer };
}

describe('the call keeps the proximity lock in step', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    mockScreenOff.length = 0;
    mockRooms.length = 0;
    Object.assign(mockNative, { proximity: true, route: 'earpiece', routeFails: false });
  });

  afterEach(async () => {
    const call = require('../src/features/call/call') as typeof import('../src/features/call/call');
    await call.hangUp('left');
    await flush();
    jest.runOnlyPendingTimers();
    await flush();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('holds it in a voice call on the call screen and lets go when the call ends', async () => {
    const { call } = await activeCall();
    expect(mockScreenOff).toEqual([true]);
    await call.hangUp('left');
    await flush();
    expect(mockScreenOff).toEqual([true, false]);
  });

  it('lets go when you turn your camera on, and takes it back when you turn it off on the earpiece', async () => {
    const { call } = await activeCall();
    await call.toggleCamera();
    await flush();
    expect(mockScreenOff).toEqual([true, false]);
    await call.toggleCamera();
    await flush();
    expect(call.callState().speaker).toBe(true);
    expect(mockScreenOff).toEqual([true, false]);
  });

  it('lets go when the other person turns a camera on', async () => {
    const { room, peer } = await activeCall();
    peer.isCameraEnabled = true;
    room.emit('trackSubscribed');
    expect(mockScreenOff).toEqual([true, false]);
  });

  it('lets go for the speaker and when the audio moves to a headset', async () => {
    const { call } = await activeCall();
    await call.toggleSpeaker();
    expect(mockScreenOff).toEqual([true, false]);
    await call.toggleSpeaker();
    expect(mockScreenOff).toEqual([true, false, true]);
    mockNative.route = 'bluetooth';
    call.setCallSurface(true);
    expect(mockScreenOff).toEqual([true, false, true, false]);
  });

  it('lets go when you leave the call screen', async () => {
    const { call } = await activeCall();
    call.setCallSurface(false);
    expect(mockScreenOff).toEqual([true, false]);
  });

  it('keeps the call working when the phone has no proximity module or cannot read the route', async () => {
    mockNative.proximity = false;
    const first = await activeCall();
    expect(first.call.callState().phase).toBe('active');
    expect(mockScreenOff).toEqual([]);
    await first.call.hangUp('left');
    await flush();
    jest.runOnlyPendingTimers();
    jest.resetModules();
    mockNative.proximity = true;
    mockNative.routeFails = true;
    const second = await activeCall();
    expect(second.call.callState().phase).toBe('active');
    expect(mockScreenOff).toEqual([]);
  });
});
