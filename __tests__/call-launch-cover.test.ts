const mockSurface: boolean[] = [];
const mockListeners: ((action: unknown) => void)[] = [];
const mockLookups: { resolve: (store: unknown) => void; reject: (error: Error) => void }[] = [];

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
    invitations() {
      return new Promise((resolve, reject) => mockLookups.push({ resolve, reject }));
    }
  },
}));

jest.mock('../src/features/call/native', () => ({
  callNative: () => ({
    takePending: () => Promise.resolve([]),
    takeLaunchAction: () => Promise.resolve(null),
    cancelRing: () => Promise.resolve(true),
    setPictureInPicture: () => Promise.resolve(true),
    leavePictureInPicture: () => Promise.resolve(true),
    setCallSurface: (visible: boolean) => {
      mockSurface.push(visible);
      return Promise.resolve(true);
    },
  }),
  onCallAction: (listener: (action: unknown) => void) => {
    mockListeners.push(listener);
    return () => undefined;
  },
}));

jest.mock('../src/features/call/livekit', () => ({
  loadClient: () => new Promise(() => undefined),
  loadLiveKit: () => Promise.reject(new Error('no sdk')),
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
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
}

const ringing = {
  'discuss.channel': [{ id: 77, channel_type: 'chat', name: 'chat' }],
  'discuss.channel.member': [
    { id: 1, channel_id: 77, partner_id: 11, rtc_inviting_session_id: 5 },
    { id: 2, channel_id: 77, partner_id: 23 },
  ],
  'discuss.channel.rtc.session': [{ id: 5, channel_member_id: 2 }],
  'res.partner': [{ id: 23, name: 'Budi' }],
};

describe('a call launch over the keyguard covers the app until the call is confirmed', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSurface.length = 0;
    mockListeners.length = 0;
    mockLookups.length = 0;
  });

  function launch() {
    const call = require('../src/features/call/call') as typeof import('../src/features/call/call');
    mockListeners[mockListeners.length - 1]({ type: 'open', channelId: 77, callId: 5, title: 'Budi', db: 'dbA', uid: 1 });
    return call;
  }

  it('shows the ringing card before the server answers', async () => {
    const call = launch();
    expect(call.callState().phase).toBe('incoming');
    expect(call.callState().callerName).toBe('Budi');
    mockLookups[0].resolve(ringing);
    await flush();
    expect(call.callState().phase).toBe('incoming');
    expect(call.callState().channelId).toBe(77);
  });

  it('drops the card and releases the keyguard when the call is already gone', async () => {
    const call = launch();
    mockLookups[0].resolve({});
    await flush();
    expect(call.callState().phase).toBe('idle');
    expect(mockSurface[mockSurface.length - 1]).toBe(false);
  });

  it('keeps the call screen over the keyguard when another call launch arrives during a call', async () => {
    const call = launch();
    mockLookups[0].resolve(ringing);
    await flush();
    void call.answer();
    await flush();
    expect(call.callState().phase).toBe('connecting');
    call.setCallSurface(true);
    mockListeners[mockListeners.length - 1]({ type: 'incoming', channelId: 88, callId: 6, title: 'Sari', db: 'dbA', uid: 1 });
    await flush();
    expect(call.callState().phase).toBe('connecting');
    expect(mockSurface[mockSurface.length - 1]).toBe(true);
  });

  it('drops the card and releases the keyguard when the server cannot be reached', async () => {
    const call = launch();
    mockLookups[0].reject(new Error('offline'));
    await flush();
    expect(call.callState().phase).toBe('idle');
    expect(mockSurface[mockSurface.length - 1]).toBe(false);
  });
});
