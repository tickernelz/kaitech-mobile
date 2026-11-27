const mockUpdates: Record<string, boolean>[] = [];
const mockJoins: { channelId: number; args: number }[] = [];
const mockAsked: string[] = [];
const mockListeners: ((action: unknown) => void)[] = [];
const mockRooms: MockRoom[] = [];
const mockPip: { enabled: boolean; camera: boolean }[] = [];
const mockNative: { startCall: unknown[][]; ring: unknown[][] } = { startCall: [], ring: [] };
const mockCamera = { grant: true };
const mockAudio: { outputs: string[]; selected: string[] } = { outputs: [], selected: [] };
let mockStore: unknown = {};
let mockPingStore: unknown = {};
const mockPingFails = { on: false };
let mockConversation: { type: string } | null = null;
const mockPresent = { names: [] as string[] };
const mockLeaves: number[] = [];

type Handler = () => void;

class MockLocal {
  isScreenShareEnabled = false;
  isCameraEnabled = false;
  isMicrophoneEnabled = false;
  trackPublications = new Map();
  attributes = {};
  sid = 'local';
  identity = 'local';
  name = 'Me';
  cameraCalls: boolean[] = [];
  cameraFails = false;
  room: MockRoom;
  constructor(room: MockRoom) {
    this.room = room;
  }
  setMicrophoneEnabled(on: boolean) {
    this.isMicrophoneEnabled = on;
    return Promise.resolve();
  }
  setCameraEnabled(on: boolean) {
    this.cameraCalls.push(on);
    if (this.cameraFails) return Promise.reject(new Error('camera busy'));
    this.isCameraEnabled = on;
    return Promise.resolve();
  }
  setScreenShareEnabled(on: boolean) {
    this.isScreenShareEnabled = on;
    this.room.emit(on ? 'localTrackPublished' : 'localTrackUnpublished');
    return Promise.resolve();
  }
  setAttributes() {
    return Promise.resolve();
  }
}

class MockRemote {
  sid: string;
  identity: string;
  name: string;
  isCameraEnabled = false;
  isMicrophoneEnabled = true;
  isScreenShareEnabled = false;
  trackPublications = new Map<string, unknown>();
  audioTrackPublications = new Map();
  attributes = {};
  constructor(sid: string, name: string) {
    this.sid = sid;
    this.identity = sid;
    this.name = name;
  }
  setVolume() {
    return undefined;
  }
  showCamera(on: boolean) {
    this.isCameraEnabled = on;
    if (on) this.trackPublications.set('camera', { videoTrack: {}, source: 'camera' });
    else this.trackPublications.delete('camera');
  }
}

class MockRoom {
  handlers = new Map<string, Handler[]>();
  localParticipant = new MockLocal(this);
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
    for (const name of mockPresent.names) this.remoteParticipants.set(name, new MockRemote(name, name));
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

jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key, language: 'en' },
}));

jest.mock('../src/auth/session', () => ({
  getSession: () => ({
    accounts: [
      { id: 'A', origin: 'https://a.test', db: 'dbA', userId: 1, partnerId: 11 },
      { id: 'B', origin: 'https://b.test', db: 'dbB', userId: 2, partnerId: 11 },
    ],
    activeId: 'A',
  }),
  onAccountForgotten: () => undefined,
}));

jest.mock('../src/features/call/api', () => ({
  CallClient: class {
    account: { id: string };
    constructor(account: { id: string }) {
      this.account = account;
    }
    join(channelId: number, ...rest: unknown[]) {
      mockJoins.push({ channelId, args: rest.length });
      return Promise.resolve({ sessionId: 9, channelId, url: 'wss://room.test', token: 't' });
    }
    update(_sessionId: number, values: Record<string, boolean>) {
      mockUpdates.push(values);
      return Promise.resolve();
    }
    ping() {
      return mockPingFails.on ? Promise.reject(new Error('offline')) : Promise.resolve(mockPingStore);
    }
    leave(channelId: number) {
      mockLeaves.push(channelId);
      return Promise.resolve();
    }
    decline() {
      return Promise.resolve();
    }
    invitations() {
      return Promise.resolve(mockStore);
    }
  },
}));

jest.mock('../src/features/call/native', () => ({
  callNative: () => ({
    takePending: () => Promise.resolve([]),
    takeLaunchAction: () => Promise.resolve(null),
    ringing: () => Promise.resolve(false),
    ring: (...args: unknown[]) => {
      mockNative.ring.push(args);
      return Promise.resolve(true);
    },
    cancelRing: () => Promise.resolve(true),
    setInCall: () => Promise.resolve(true),
    setCallSurface: () => Promise.resolve(true),
    startCall: (...args: unknown[]) => {
      mockNative.startCall.push(args);
      return Promise.resolve(true);
    },
    stopCall: () => Promise.resolve(true),
    updateCall: () => Promise.resolve(true),
    setPictureInPicture: (enabled: boolean, _width: number, _height: number, _muted: boolean, camera: boolean) => {
      mockPip.push({ enabled, camera });
      return Promise.resolve(true);
    },
    leavePictureInPicture: () => Promise.resolve(true),
  }),
  onCallAction: (listener: (action: unknown) => void) => {
    mockListeners.push(listener);
    return () => undefined;
  },
}));

jest.mock('../src/features/call/livekit', () => ({
  loadClient: () =>
    Promise.resolve({
      Room: MockRoom,
      RoomEvent: {
        ParticipantConnected: 'participantConnected',
        ParticipantDisconnected: 'participantDisconnected',
        TrackSubscribed: 'trackSubscribed',
        TrackUnsubscribed: 'trackUnsubscribed',
        TrackMuted: 'trackMuted',
        TrackUnmuted: 'trackUnmuted',
        LocalTrackPublished: 'localTrackPublished',
        LocalTrackUnpublished: 'localTrackUnpublished',
        ActiveSpeakersChanged: 'activeSpeakersChanged',
        ParticipantAttributesChanged: 'participantAttributesChanged',
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
        getAudioOutputs: () => Promise.resolve(mockAudio.outputs),
        selectAudioOutput: (output: string) => {
          mockAudio.selected.push(output);
          return Promise.resolve();
        },
      },
    }),
}));

jest.mock('../src/features/call/screenShare', () => ({ pickBroadcast: () => Promise.resolve(true) }));

jest.mock('../src/features/call/permissions', () => ({
  ensureMicrophone: () => {
    mockAsked.push('microphone');
    return Promise.resolve(true);
  },
  ensureCamera: () => {
    mockAsked.push('camera');
    return Promise.resolve(mockCamera.grant);
  },
}));

jest.mock('../src/features/chat/chat', () => ({
  conversationById: () => mockConversation,
  getChat: () => ({ threads: {}, conversations: [] }),
  invitedChannels: () => [],
}));

async function flush() {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
}

function load() {
  return require('../src/features/call/call') as typeof import('../src/features/call/call');
}

async function placed() {
  const call = load();
  await call.startCall({ channelId: 5, channelName: 'Team' });
  await flush();
  expect(call.callState().phase).toBe('active');
  mockUpdates.length = 0;
  return { call, room: mockRooms[mockRooms.length - 1] };
}

function joinRemote(room: MockRoom, sid = '42', name = 'Sari') {
  const remote = new MockRemote(sid, name);
  room.remoteParticipants.set(sid, remote);
  room.emit('participantConnected');
  return remote;
}

const lastPip = () => mockPip[mockPip.length - 1];

beforeEach(() => {
  jest.useFakeTimers();
  for (const list of [mockUpdates, mockJoins, mockAsked, mockListeners, mockRooms, mockPip, mockNative.startCall, mockNative.ring]) list.length = 0;
  mockCamera.grant = true;
  mockAudio.outputs = [];
  mockAudio.selected = [];
  mockStore = {};
  mockPingStore = {};
  mockPingFails.on = false;
  mockConversation = null;
  mockPresent.names = [];
  mockLeaves.length = 0;
  jest.resetModules();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('one call that starts as voice', () => {
  it('asks only for the microphone and joins with the camera off', async () => {
    const { call, room } = await placed();
    expect(mockAsked).toEqual(['microphone']);
    expect(mockJoins).toEqual([{ channelId: 5, args: 0 }]);
    expect(room.localParticipant.cameraCalls).toEqual([]);
    expect(call.callState()).toMatchObject({ cameraOn: false, cameraBlocked: false, speaker: false });
    expect(mockNative.startCall[0]).toEqual(['Team', 'call:inCall', 5]);
    expect(lastPip().enabled).toBe(false);
  });
});

describe('calling again right after hanging up', () => {
  it('keeps the new call when the previous call ends its closing pause', async () => {
    const { call } = await placed();
    await call.hangUp('left');
    expect(call.callState().phase).toBe('ended');
    await call.startCall({ channelId: 5, channelName: 'Team' });
    await flush();
    expect(call.callState().phase).toBe('active');
    jest.advanceTimersByTime(3000);
    await flush();
    expect(call.callState().phase).toBe('active');
    expect(mockJoins).toHaveLength(2);
  });
});

describe('turning the camera on during a call', () => {
  it('asks for the camera on the first press, publishes it and tells Odoo', async () => {
    const { call, room } = await placed();
    expect(await call.toggleCamera()).toBe('on');
    await flush();
    expect(mockAsked).toEqual(['microphone', 'camera']);
    expect(room.localParticipant.cameraCalls).toEqual([true]);
    expect(call.callState()).toMatchObject({ phase: 'active', cameraOn: true, cameraBlocked: false });
    expect(call.callState().people.find((person) => person.local)?.cameraOn).toBe(true);
    expect(mockUpdates).toEqual([{ is_camera_on: true }]);
    expect(lastPip()).toEqual({ enabled: true, camera: true });
    expect(await call.toggleCamera()).toBe('off');
    expect(call.callState().cameraOn).toBe(false);
    expect(mockUpdates).toEqual([{ is_camera_on: true }, { is_camera_on: false }]);
  });

  it('moves the call to the loudspeaker when the camera turns on, unless the user picked an output or wears a headset', async () => {
    mockAudio.outputs = ['earpiece', 'speaker'];
    const first = await placed();
    expect(first.call.callState().speaker).toBe(false);
    expect(await first.call.toggleCamera()).toBe('on');
    expect(first.call.callState().speaker).toBe(true);
    expect(mockAudio.selected).toEqual(['earpiece', 'speaker']);
    await first.call.hangUp('left');
    jest.runOnlyPendingTimers();

    mockAudio.selected = [];
    const picked = await placed();
    await picked.call.toggleSpeaker();
    await picked.call.toggleSpeaker();
    expect(await picked.call.toggleCamera()).toBe('on');
    expect(picked.call.callState().speaker).toBe(false);
    expect(mockAudio.selected).toEqual(['earpiece', 'speaker', 'earpiece']);
    await picked.call.hangUp('left');
    jest.runOnlyPendingTimers();

    mockAudio.outputs = ['earpiece', 'speaker', 'bluetooth'];
    mockAudio.selected = [];
    const headset = await placed();
    expect(await headset.call.toggleCamera()).toBe('on');
    expect(headset.call.callState().speaker).toBe(false);
    expect(mockAudio.selected).toEqual(['earpiece']);
  });

  it('keeps the call going when the camera is refused and lets a later press try again', async () => {
    const { call, room } = await placed();
    mockCamera.grant = false;
    expect(await call.toggleCamera()).toBe('blocked');
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'active', cameraOn: false, cameraBlocked: true, endedReason: null });
    expect(room.localParticipant.cameraCalls).toEqual([]);
    expect(mockUpdates).toEqual([]);
    mockCamera.grant = true;
    expect(await call.toggleCamera()).toBe('on');
    expect(call.callState()).toMatchObject({ phase: 'active', cameraOn: true, cameraBlocked: false });
  });

  it('negative control: a camera that fails to start leaves it off without ending the call', async () => {
    const { call, room } = await placed();
    room.localParticipant.cameraFails = true;
    expect(await call.toggleCamera()).toBe('unavailable');
    expect(call.callState()).toMatchObject({ phase: 'active', cameraOn: false });
    expect(mockUpdates).toEqual([]);
  });

  it('does nothing outside a call', async () => {
    const call = load();
    expect(await call.toggleCamera()).toBe('unavailable');
    expect(mockAsked).toEqual([]);
    expect(call.callState().phase).toBe('idle');
  });
});

describe('screen sharing next to someone else video', () => {
  it('starts and stops the share while the other person shows a camera', async () => {
    const { call, room } = await placed();
    joinRemote(room).showCamera(true);
    room.emit('trackSubscribed');
    await call.toggleScreenShare();
    await flush();
    expect(call.callState().screenSharing).toBe(true);
    expect(mockUpdates).toContainEqual({ is_screen_sharing_on: true });
    await call.toggleScreenShare();
    await flush();
    expect(call.callState().screenSharing).toBe(false);
    expect(mockUpdates[mockUpdates.length - 1]).toEqual({ is_screen_sharing_on: false });
    expect(call.callState().people.find((person) => !person.local)?.cameraOn).toBe(true);
  });
});

describe('someone else turns video on and off', () => {
  it('follows the other person camera while the call stays voice for me', async () => {
    const { call, room } = await placed();
    const remote = joinRemote(room);
    expect(call.callState().people.find((person) => person.sid === '42')?.cameraOn).toBe(false);
    remote.showCamera(true);
    room.emit('trackSubscribed');
    expect(call.callState().people.find((person) => person.sid === '42')?.cameraOn).toBe(true);
    expect(call.videoTrack('42')).not.toBeNull();
    expect(lastPip().enabled).toBe(true);
    remote.showCamera(false);
    room.emit('trackUnsubscribed');
    expect(call.callState().people.find((person) => person.sid === '42')?.cameraOn).toBe(false);
    expect(call.videoTrack('42')).toBeNull();
    expect(lastPip().enabled).toBe(false);
    expect(call.callState()).toMatchObject({ phase: 'active', cameraOn: false });
  });
});

describe('an incoming call from the web or an older app', () => {
  const ringing = {
    'discuss.channel': [{ id: 7, channel_type: 'chat', name: 'Web, HP' }],
    'discuss.channel.member': [
      { id: 70, channel_id: 7, partner_id: 22 },
      { id: 71, channel_id: 7, partner_id: 11, rtc_inviting_session_id: 30 },
    ],
    'discuss.channel.rtc.session': [{ id: 30, channel_member_id: 70, is_camera_on: true }],
    'res.partner': [{ id: 22, name: 'Web Caller' }],
  };

  it('rings without a video flag and is answered as a voice call, camera off', async () => {
    mockStore = ringing;
    const call = load();
    mockListeners[mockListeners.length - 1]({ type: 'incoming', channelId: 7, callId: 30, video: true, title: 'Web Caller' });
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'incoming', channelId: 7, callerName: 'Web Caller' });
    expect(call.callState()).not.toHaveProperty('video');
    await call.answer();
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'active', cameraOn: false });
    expect(mockAsked).toEqual(['microphone']);
    expect(mockJoins).toEqual([{ channelId: 7, args: 0 }]);
    expect(mockRooms[0].localParticipant.cameraCalls).toEqual([]);
  });

  it('rings in the app with one call text and no video argument', async () => {
    mockStore = ringing;
    const call = load();
    call.startAccount({ id: 'A', origin: 'https://a.test', db: 'dbA', userId: 1, partnerId: 11 } as never);
    await flush();
    expect(call.callState().phase).toBe('incoming');
    expect(mockNative.ring[0]).toEqual(['Web Caller', 'call:incoming', 7, 30, 'dbA', 1]);
  });

  it('joins the ringing call when Call is pressed in the same conversation, and ignores another conversation', async () => {
    mockStore = ringing;
    const call = load();
    mockListeners[mockListeners.length - 1]({ type: 'incoming', channelId: 7, callId: 30, title: 'Web Caller' });
    await flush();
    await call.startCall({ channelId: 8, channelName: 'Other' });
    expect(call.callState()).toMatchObject({ phase: 'incoming', channelId: 7 });
    expect(mockJoins).toEqual([]);
    await call.startCall({ channelId: 7, channelName: 'Web, HP' });
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'active', channelId: 7, cameraOn: false });
    expect(mockJoins).toEqual([{ channelId: 7, args: 0 }]);
  });

  it('leaves a call ringing on another account alone when Call is pressed in a channel with the same id', async () => {
    mockStore = ringing;
    const call = load();
    mockListeners[mockListeners.length - 1]({ type: 'incoming', channelId: 7, callId: 30, title: 'Web Caller', db: 'dbB', uid: 2 });
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'incoming', channelId: 7 });
    await call.startCall({ channelId: 7, channelName: 'Web, HP' });
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'incoming', channelId: 7 });
    expect(mockJoins).toEqual([]);
  });

  it('stays idle when the invitation is already gone', async () => {
    mockStore = {};
    const call = load();
    mockListeners[mockListeners.length - 1]({ type: 'incoming', channelId: 7, callId: 30, video: true, title: 'Web Caller' });
    await flush();
    expect(call.callState().phase).toBe('idle');
    await call.answer();
    expect(mockJoins).toEqual([]);
  });
});

describe('a call nobody has answered yet', () => {
  const invitations = (mode: 'ADD' | 'DELETE', ids: number[]) => ({ 'discuss.channel': [{ id: 5, invited_member_ids: [[mode, ids]] }] });

  it('says Calling, then Ringing once the invitation is out, and starts the clock from 00:00 only when someone joins', async () => {
    const { call, room } = await placed();
    expect(call.callState()).toMatchObject({ waiting: 'calling', startedAt: 0 });
    call.onNotification('mail.record/insert', invitations('ADD', [77]));
    expect(call.callState().waiting).toBe('ringing');
    jest.advanceTimersByTime(12_000);
    expect(call.callState().startedAt).toBe(0);
    joinRemote(room);
    expect(call.callState()).toMatchObject({ waiting: null, startedAt: Date.now() });
  });

  it('ends as unanswered when the person declines and nobody else is in the call', async () => {
    const { call } = await placed();
    call.onNotification('mail.record/insert', invitations('ADD', [77]));
    call.onNotification('mail.record/insert', invitations('DELETE', [77]));
    jest.advanceTimersByTime(4_000);
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'ended', endedReason: 'unanswered' });
    expect(mockLeaves).toEqual([5]);
  });

  it('keeps ringing when the invitation is gone because the person is joining', async () => {
    const { call, room } = await placed();
    mockPingStore = { 'discuss.channel': [{ id: 5, rtc_session_ids: [['ADD', [9, 10]]] }] };
    call.onNotification('mail.record/insert', invitations('ADD', [77]));
    call.onNotification('mail.record/insert', invitations('DELETE', [77]));
    jest.advanceTimersByTime(4_000);
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'active', startedAt: 0 });
    joinRemote(room);
    expect(call.callState().startedAt).toBe(Date.now());
  });

  it('keeps ringing until the ring limit for a person who joined on the server but whose call connects slowly', async () => {
    const { call, room } = await placed();
    mockPingStore = { 'discuss.channel': [{ id: 5, rtc_session_ids: [['ADD', [9, 10]]] }] };
    call.onNotification('mail.record/insert', invitations('ADD', [77]));
    jest.advanceTimersByTime(2_000);
    call.onNotification('mail.record/insert', invitations('DELETE', [77]));
    for (let elapsed = 2_000; elapsed < 44_000; elapsed += 4_000) {
      jest.advanceTimersByTime(4_000);
      await flush();
      expect(call.callState()).toMatchObject({ phase: 'active', startedAt: 0 });
    }
    joinRemote(room);
    expect(call.callState().startedAt).toBe(Date.now());
  });

  it('ends as unanswered when that person never reaches the call, a few checks after the ring limit', async () => {
    const { call } = await placed();
    mockPingStore = { 'discuss.channel': [{ id: 5, rtc_session_ids: [['ADD', [9, 10]]] }] };
    call.onNotification('mail.record/insert', invitations('ADD', [77]));
    call.onNotification('mail.record/insert', invitations('DELETE', [77]));
    jest.advanceTimersByTime(4_000);
    await flush();
    jest.advanceTimersByTime(41_000);
    await flush();
    for (let check = 0; check < 3; check += 1) {
      expect(call.callState().phase).toBe('active');
      jest.advanceTimersByTime(4_000);
      await flush();
    }
    expect(call.callState()).toMatchObject({ phase: 'ended', endedReason: 'unanswered' });
  });

  it('ends as unanswered after 45 seconds when nobody ever joins', async () => {
    const { call } = await placed();
    jest.advanceTimersByTime(44_000);
    await flush();
    expect(call.callState().phase).toBe('active');
    jest.advanceTimersByTime(1_000);
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'ended', endedReason: 'unanswered' });
  });

  it('checks again when the server cannot be reached at the ring limit, and ends once it answers that nobody joined', async () => {
    const { call } = await placed();
    mockPingFails.on = true;
    jest.advanceTimersByTime(45_000);
    await flush();
    expect(call.callState().phase).toBe('active');
    mockPingFails.on = false;
    jest.advanceTimersByTime(4_000);
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'ended', endedReason: 'unanswered' });
  });

  it('stops waiting for a person who joined on the server but never reached the room', async () => {
    const { call } = await placed();
    mockPingStore = { 'discuss.channel': [{ id: 5, rtc_session_ids: [['ADD', [9, 10]]] }] };
    jest.advanceTimersByTime(45_000);
    await flush();
    for (let check = 0; check < 3; check += 1) {
      expect(call.callState().phase).toBe('active');
      jest.advanceTimersByTime(4_000);
      await flush();
    }
    expect(call.callState()).toMatchObject({ phase: 'ended', endedReason: 'unanswered' });
  });

  it('never ends an answered call at the ring limit', async () => {
    const { call, room } = await placed();
    joinRemote(room);
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(call.callState().phase).toBe('active');
  });

  it('starts the clock at once when joining a call others are already in', async () => {
    mockPresent.names = ['41'];
    const { call } = await placed();
    expect(call.callState()).toMatchObject({ waiting: null, startedAt: Date.now() });
  });

  it('waits in a channel without ringing anyone or a time limit', async () => {
    mockConversation = { type: 'channel' };
    const { call } = await placed();
    expect(call.callState().waiting).toBe('alone');
    jest.advanceTimersByTime(120_000);
    await flush();
    expect(call.callState()).toMatchObject({ phase: 'active', waiting: 'alone', startedAt: 0 });
  });
});

