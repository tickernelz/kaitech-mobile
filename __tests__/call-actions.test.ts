const mockUpdates: Record<string, boolean>[] = [];
const mockRooms: MockRoom[] = [];
const mockSaved: [number, number][] = [];
const mockOutputs: string[] = [];

type Handler = () => void;

class MockPublication {
  enabled = true;
  setEnabled(on: boolean) {
    this.enabled = on;
  }
}

class MockRemote {
  sid: string;
  identity: string;
  name: string;
  attributes: Record<string, string> = {};
  isCameraEnabled = false;
  isMicrophoneEnabled = true;
  isScreenShareEnabled = false;
  trackPublications = new Map();
  audioTrackPublications = new Map([['a', new MockPublication()]]);
  volume = 1;
  constructor(sid: string, identity: string) {
    this.sid = sid;
    this.identity = identity;
    this.name = sid;
  }
  setVolume(volume: number) {
    this.volume = volume;
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
  told: Record<string, string>[] = [];
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
    this.told.push(next);
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

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
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
    update(_sessionId: number, values: Record<string, boolean>) {
      mockUpdates.push(values);
      return Promise.resolve();
    }
    ping() {
      return Promise.resolve({ 'discuss.channel.rtc.session': [{ id: 31, channel_member_id: 41 }], 'discuss.channel.member': [{ id: 41, partner_id: 77 }] });
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
    setPictureInPicture: () => Promise.resolve(true),
    leavePictureInPicture: () => Promise.resolve(true),
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
        getAudioOutputs: () => Promise.resolve(['speaker', 'earpiece', 'bluetooth']),
        selectAudioOutput: (output: string) => {
          mockOutputs.push(output);
          return Promise.resolve();
        },
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
jest.mock('../src/features/call/volumes', () => ({
  loadVolumes: () => Promise.resolve(new Map([[77, 0.3]])),
  saveVolume: (_account: unknown, partnerId: number, volume: number) => {
    mockSaved.push([partnerId, volume]);
    return Promise.resolve();
  },
}));
jest.mock('../src/features/chat/chat', () => ({
  conversationById: () => ({ id: 5, type: 'chat', partnerId: 77 }),
  getChat: () => ({ threads: {}, conversations: [] }),
  invitedChannels: () => [],
}));

async function flush() {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
}

async function activeCall() {
  const call = require('../src/features/call/call');
  await call.startCall({ channelId: 5, channelName: 'Team', video: false });
  await flush();
  expect(call.callState().phase).toBe('active');
  const room = mockRooms[mockRooms.length - 1];
  const peer = new MockRemote('PA', '31');
  room.remoteParticipants.set(peer.sid, peer);
  room.emit('participantConnected');
  mockUpdates.length = 0;
  return { call, room, peer };
}

describe('call actions from More', () => {
  beforeEach(() => {
    jest.resetModules();
    mockUpdates.length = 0;
    mockRooms.length = 0;
    mockSaved.length = 0;
    mockOutputs.length = 0;
  });

  afterEach(async () => {
    const call = require('../src/features/call/call');
    await call.hangUp('left');
  });

  it('deafen stops the microphone and incoming audio, and tells the web through the session and the deaf attribute', async () => {
    const { call, room, peer } = await activeCall();
    expect(room.localParticipant.isMicrophoneEnabled).toBe(true);
    await call.toggleDeafen();
    expect(room.localParticipant.isMicrophoneEnabled).toBe(false);
    expect(peer.audioTrackPublications.get('a')?.enabled).toBe(false);
    expect(room.localParticipant.attributes.deaf).toBe('1');
    expect(mockUpdates).toContainEqual({ is_deaf: true });
    expect(call.callState().deaf).toBe(true);
  });

  it('undeafen gives the microphone back only when the user had not muted it', async () => {
    const { call, room, peer } = await activeCall();
    await call.toggleMute();
    await call.toggleDeafen();
    await call.toggleDeafen();
    expect(room.localParticipant.isMicrophoneEnabled).toBe(false);
    expect(peer.audioTrackPublications.get('a')?.enabled).toBe(true);
    expect(room.localParticipant.attributes.deaf).toBe('0');
  });

  it('the microphone button while deaf undeafens and unmutes, like the web', async () => {
    const { call, room, peer } = await activeCall();
    await call.toggleDeafen();
    mockUpdates.length = 0;
    await call.toggleMute();
    expect(room.localParticipant.isMicrophoneEnabled).toBe(true);
    expect(peer.audioTrackPublications.get('a')?.enabled).toBe(true);
    expect(call.callState()).toMatchObject({ muted: false, deaf: false });
    expect(mockUpdates).toEqual([{ is_deaf: false }]);
  });

  it('raise hand sets the hand attribute the web reads and shows it on the participant', async () => {
    const { call, room, peer } = await activeCall();
    call.toggleHand();
    expect(room.localParticipant.attributes.hand).toBe('1');
    peer.attributes = { hand: '1' };
    room.emit('participantAttributesChanged');
    expect(call.callState().people.find((person: { sid: string }) => person.sid === 'PA')?.hand).toBe(true);
    call.toggleHand();
    expect(room.localParticipant.attributes.hand).toBe('0');
  });

  it('keeps other attributes when it writes one', async () => {
    const { call, room } = await activeCall();
    call.toggleHand();
    await call.toggleDeafen();
    expect(room.localParticipant.attributes).toEqual({ hand: '1', deaf: '1' });
  });

  it('applies the saved volume of a person and saves a new one under their partner', async () => {
    const { call, peer } = await activeCall();
    expect(peer.volume).toBe(0.3);
    expect(call.personVolume(77)).toBe(0.3);
    call.setPersonVolume('PA', 0.6);
    expect(peer.volume).toBe(0.6);
    expect(call.personVolume(77)).toBe(0.6);
    expect(mockSaved).toEqual([[77, 0.6]]);
    call.setPersonVolume('PA', 4);
    expect(peer.volume).toBe(1);
  });

  it('chooses an audio output and reports the speaker state', async () => {
    const { call } = await activeCall();
    expect(await call.audioOutputs()).toEqual(['speaker', 'earpiece', 'bluetooth']);
    await call.chooseAudioOutput('earpiece');
    expect(mockOutputs[mockOutputs.length - 1]).toBe('earpiece');
    expect(call.callState()).toMatchObject({ output: 'earpiece', speaker: false });
  });

  it('does nothing before the call connects', async () => {
    const call = require('../src/features/call/call');
    call.toggleHand();
    await call.toggleDeafen();
    expect(mockRooms).toHaveLength(0);
    expect(call.callState()).toMatchObject({ hand: false, deaf: false });
  });
});
