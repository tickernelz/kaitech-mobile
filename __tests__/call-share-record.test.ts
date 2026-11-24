const mockUpdates: Record<string, boolean>[] = [];
const mockNotices: boolean[] = [];
const mockTitles: string[] = [];
const mockListeners: ((action: unknown) => void)[] = [];
const mockRooms: MockRoom[] = [];
const mockPip: { enabled: boolean; width: number; height: number; muted: boolean; camera: boolean; sharing: boolean }[] = [];
let mockLeftPip = 0;

type Handler = () => void;

class MockLocal {
  isScreenShareEnabled = false;
  isCameraEnabled = false;
  isMicrophoneEnabled = false;
  trackPublications = new Map();
  sid = 'local';
  identity = 'local';
  name = 'Me';
  shareCalls: boolean[] = [];
  refuse = false;
  room: MockRoom;
  constructor(room: MockRoom) {
    this.room = room;
  }
  setMicrophoneEnabled(on: boolean) {
    this.isMicrophoneEnabled = on;
    return Promise.resolve();
  }
  setCameraEnabled(on: boolean) {
    this.isCameraEnabled = on;
    return Promise.resolve();
  }
  setScreenShareEnabled(on: boolean) {
    this.shareCalls.push(on);
    if (this.refuse) return Promise.reject(new Error('NotAllowedError'));
    this.isScreenShareEnabled = on;
    this.room.emit(on ? 'localTrackPublished' : 'localTrackUnpublished');
    return Promise.resolve();
  }
}

class MockRoom {
  handlers = new Map<string, Handler[]>();
  localParticipant = new MockLocal(this);
  remoteParticipants = new Map();
  activeSpeakers = [];
  isRecording = false;
  options: Record<string, unknown>;
  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
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

jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key, language: 'en' },
}));

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
    updateCall: (...args: unknown[]) => {
      mockNotices.push(args[5] as boolean);
      mockTitles.push(args[0] as string);
      return Promise.resolve(true);
    },
    setPictureInPicture: (enabled: boolean, width: number, height: number, muted: boolean, camera: boolean, sharing: boolean) => {
      mockPip.push({ enabled, width, height, muted, camera, sharing });
      return Promise.resolve(true);
    },
    leavePictureInPicture: () => {
      mockLeftPip += 1;
      return Promise.resolve(true);
    },
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
        getAudioOutputs: () => Promise.resolve([]),
        selectAudioOutput: () => Promise.resolve(),
      },
    }),
}));

jest.mock('../src/features/call/screenShare', () => ({ pickBroadcast: () => Promise.resolve(true) }));

const mockRecordingCalls: string[] = [];
let mockRecordingFailure: { code: string } | null = null;

jest.mock('../src/features/call/recording', () => ({
  startRecording: (account: { id: string }, channelId: number) => {
    mockRecordingCalls.push(account.id + ':start:' + channelId);
    return mockRecordingFailure ? Promise.reject(mockRecordingFailure) : Promise.resolve({ id: 7, startedBy: 'Budi' });
  },
  stopRecording: (account: { id: string }, channelId: number) => {
    mockRecordingCalls.push(account.id + ':stop:' + channelId);
    return Promise.resolve({ id: 7, startedBy: 'Budi' });
  },
  currentRecording: (account: { id: string }, channelId: number) => {
    mockRecordingCalls.push(account.id + ':status:' + channelId);
    return Promise.resolve({ id: 7, startedBy: 'Sari' });
  },
}));

jest.mock('../src/features/call/permissions', () => ({
  ensureMicrophone: () => Promise.resolve(true),
  ensureCamera: () => Promise.resolve(true),
}));

jest.mock('../src/features/chat/chat', () => ({
  conversationById: () => null,
  getChat: () => ({ threads: {}, conversations: [] }),
  invitedChannels: () => [],
}));

async function flush() {
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
}

async function activeCall(camera = false) {
  const call = require('../src/features/call/call');
  await call.startCall({ channelId: 5, channelName: 'Team' });
  await flush();
  expect(call.callState().phase).toBe('active');
  if (camera) {
    await call.toggleCamera();
    await flush();
  }
  mockUpdates.length = 0;
  mockNotices.length = 0;
  return { call, room: mockRooms[mockRooms.length - 1] };
}

describe('screen sharing in a call', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUpdates.length = 0;
    mockNotices.length = 0;
    mockListeners.length = 0;
    mockRooms.length = 0;
    mockRecordingCalls.length = 0;
    mockRecordingFailure = null;
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('receives remote video on its own peer connection, so publishing the camera or a screen cannot renegotiate it', async () => {
    const { room } = await activeCall();
    expect(room.options).toMatchObject({ singlePeerConnection: false });
  });

  it('starts sharing, tells Odoo and shows the stop action in the call notification', async () => {
    const { call, room } = await activeCall();
    await call.toggleScreenShare();
    await flush();
    expect(room.localParticipant.shareCalls).toEqual([true]);
    expect(call.callState().screenSharing).toBe(true);
    expect(mockUpdates).toContainEqual({ is_screen_sharing_on: true });
    expect(mockNotices[mockNotices.length - 1]).toBe(true);
    expect(mockTitles[mockTitles.length - 1]).toBe('call:sharingTitle');
  });

  it('stops sharing from the notification action', async () => {
    const { call, room } = await activeCall();
    await call.toggleScreenShare();
    await flush();
    mockListeners[mockListeners.length - 1]({ type: 'stopShare' });
    await flush();
    expect(room.localParticipant.shareCalls).toEqual([true, false]);
    expect(call.callState().screenSharing).toBe(false);
    expect(mockUpdates[mockUpdates.length - 1]).toEqual({ is_screen_sharing_on: false });
    expect(mockNotices[mockNotices.length - 1]).toBe(false);
    expect(mockTitles[mockTitles.length - 1]).toBe('Team');
  });

  it('follows a stop that came from the system bar', async () => {
    const { call, room } = await activeCall();
    await call.toggleScreenShare();
    await flush();
    room.localParticipant.isScreenShareEnabled = false;
    room.emit('localTrackUnpublished');
    await flush();
    expect(call.callState().screenSharing).toBe(false);
    expect(mockUpdates[mockUpdates.length - 1]).toEqual({ is_screen_sharing_on: false });
  });

  it('hides the conversation name from the notification before the capture starts', async () => {
    const { call, room } = await activeCall();
    let titleAtCapture = '';
    const share = room.localParticipant.setScreenShareEnabled.bind(room.localParticipant);
    room.localParticipant.setScreenShareEnabled = (on: boolean) => {
      titleAtCapture = mockTitles[mockTitles.length - 1];
      return share(on);
    };
    await call.toggleScreenShare();
    await flush();
    expect(titleAtCapture).toBe('call:sharingTitle');
  });

  it('negative control: a refused system prompt leaves the call unchanged', async () => {
    const { call, room } = await activeCall();
    room.localParticipant.refuse = true;
    await call.toggleScreenShare();
    await flush();
    expect(call.callState().screenSharing).toBe(false);
    expect(mockUpdates).toEqual([]);
    expect(mockTitles[mockTitles.length - 1]).toBe('Team');
  });

});

describe('picture-in-picture during a call', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUpdates.length = 0;
    mockListeners.length = 0;
    mockRooms.length = 0;
    mockPip.length = 0;
    mockLeftPip = 0;
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const lastPip = () => mockPip[mockPip.length - 1];

  it('arms automatic picture-in-picture once the camera is on', async () => {
    await activeCall(true);
    expect(lastPip()).toMatchObject({ enabled: true, camera: true, muted: false });
  });

  it('keeps a call without any video out of picture-in-picture', async () => {
    await activeCall(false);
    expect(lastPip().enabled).toBe(false);
  });

  it('mutes and turns the camera off from the window actions, then stops arming the window once no video is left', async () => {
    const { call } = await activeCall(true);
    mockListeners[mockListeners.length - 1]({ type: 'mute' });
    await flush();
    mockListeners[mockListeners.length - 1]({ type: 'camera' });
    await flush();
    expect(call.callState().muted).toBe(true);
    expect(call.callState().cameraOn).toBe(false);
    expect(mockUpdates).toEqual([{ is_muted: true }, { is_camera_on: false }]);
    expect(lastPip()).toMatchObject({ enabled: false, muted: true, camera: false });
  });

  it('offers stop sharing in the window while the screen is shared', async () => {
    const { call } = await activeCall(true);
    await call.toggleScreenShare();
    await flush();
    expect(lastPip()).toMatchObject({ enabled: true, sharing: true });
  });

  it('turns off when the setting is off', async () => {
    await activeCall(true);
    require('../src/features/call/pipSetting').setPictureInPictureAllowed(false);
    expect(lastPip().enabled).toBe(false);
  });

  it('closes the window once a call that ended in it goes idle', async () => {
    const { call } = await activeCall(true);
    mockListeners[mockListeners.length - 1]({ type: 'pip', active: true });
    expect(call.callState().pictureInPicture).toBe(true);
    await call.hangUp('left');
    await flush();
    expect(lastPip().enabled).toBe(false);
    expect(mockLeftPip).toBe(0);
    jest.advanceTimersByTime(2400);
    expect(call.callState().phase).toBe('idle');
    expect(mockLeftPip).toBeGreaterThan(0);
  });
});

describe('keeping the call alive in the background', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockListeners.length = 0;
    mockRooms.length = 0;
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('holds the background task for the whole call and releases it when the call ends', async () => {
    const { call } = await activeCall(false);
    let done = false;
    void require('../src/features/call/keepAlive').untilCallEnds().then(() => {
      done = true;
    });
    await flush();
    expect(done).toBe(false);
    await call.hangUp('left');
    await flush();
    expect(done).toBe(true);
  });

  it('does not hold a task when no call is running', async () => {
    let done = false;
    void require('../src/features/call/keepAlive').untilCallEnds().then(() => {
      done = true;
    });
    await flush();
    expect(done).toBe(true);
  });
});

describe('recording a call', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUpdates.length = 0;
    mockListeners.length = 0;
    mockRooms.length = 0;
    mockRecordingCalls.length = 0;
    mockRecordingFailure = null;
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('follows the room recording state and names who started it', async () => {
    const { call, room } = await activeCall();
    expect(call.callState().recording).toBe(false);
    room.isRecording = true;
    room.emit('recordingStatusChanged');
    await flush();
    expect(call.callState().recording).toBe(true);
    expect(call.callState().recordingBy).toBe('Sari');
    expect(mockRecordingCalls).toEqual(['A:status:5']);
  });

  it('starts on the call account and channel, then stops while recording', async () => {
    const { call, room } = await activeCall();
    await call.toggleRecording();
    expect(mockRecordingCalls).toEqual(['A:start:5']);
    expect(call.callState().recordingBusy).toBe(false);
    room.isRecording = true;
    room.emit('recordingStatusChanged');
    await flush();
    await call.toggleRecording();
    expect(mockRecordingCalls[mockRecordingCalls.length - 1]).toBe('A:stop:5');
  });

  it('negative control: a refused start keeps the call unrecorded and reports the code', async () => {
    const { call } = await activeCall();
    mockRecordingFailure = { code: 'recording_busy' };
    await call.toggleRecording();
    expect(call.callState().recording).toBe(false);
    expect(call.callState().recordingError).toBe('recording_busy');
    expect(call.callState().recordingBusy).toBe(false);
  });
});
