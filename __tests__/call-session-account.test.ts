const mockCalls: string[] = [];
const mockListeners: ((action: unknown) => void)[] = [];

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
      { id: 'B', origin: 'https://b.test', db: 'dbB', userId: 2, partnerId: 22 },
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
    decline(channelId: number) {
      mockCalls.push(this.account.id + ':decline:' + channelId);
      return Promise.resolve();
    }
    join(channelId: number) {
      mockCalls.push(this.account.id + ':join:' + channelId);
      return Promise.reject(new Error('offline'));
    }
    invitations() {
      return Promise.resolve({
        'discuss.channel': [{ id: 77, channel_type: 'chat', name: 'chat B', invited_member_ids: [['ADD', [1]]] }],
        'discuss.channel.member': [{ id: 1, channel_id: 77, partner_id: 22, rtc_inviting_session_id: 5 }],
        'discuss.channel.rtc.session': [{ id: 5, channel_member_id: 2 }],
        'res.partner': [{ id: 23, name: 'Caller B' }],
      });
    }
  },
}));

jest.mock('../src/features/call/native', () => ({
  callNative: () => null,
  onCallAction: (listener: (action: unknown) => void) => {
    mockListeners.push(listener);
    return () => undefined;
  },
}));

jest.mock('../src/features/call/livekit', () => ({
  loadClient: () => Promise.reject(new Error('no sdk')),
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

async function ringForB() {
  require('../src/features/call/call');
  const listener = mockListeners[mockListeners.length - 1];
  listener({ type: 'incoming', channelId: 77, db: 'dbB', uid: 2, title: 'Caller B' });
  await flush();
}

describe('a ring from another account stays on that account', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCalls.length = 0;
    mockListeners.length = 0;
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('declines on the account that owns the ring, not the active one', async () => {
    await ringForB();
    const call = require('../src/features/call/call');
    expect(call.callState().phase).toBe('incoming');
    await call.decline();
    expect(mockCalls).toContain('B:decline:77');
    expect(mockCalls.some((entry) => entry.startsWith('A:'))).toBe(false);
  });

  it('negative control: an action for an unknown account changes nothing', async () => {
    await ringForB();
    const call = require('../src/features/call/call');
    const listener = mockListeners[mockListeners.length - 1];
    listener({ type: 'decline', channelId: 77, db: 'dbZ', uid: 99 });
    await flush();
    expect(mockCalls).toEqual([]);
    expect(call.callState().phase).toBe('incoming');
  });
});
