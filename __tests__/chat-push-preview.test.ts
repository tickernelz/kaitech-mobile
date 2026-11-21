const mockLock = { enabled: false, listeners: [] as (() => void)[] };
const mockForgotten: ((id: string) => void)[] = [];
const mockSent: string[] = [];
const mockValues = new Map<string, string>();
const mockAccounts = [
  { id: 'a', deviceId: 1 },
  { id: 'b', deviceId: 2 },
];

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), AndroidImportance: { HIGH: 4 }, getPermissionsAsync: async () => ({ granted: false }) }));
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockValues.get(key) ?? null,
    setItemSync: (key: string, value: string) => void mockValues.set(key, value),
    removeItemSync: (key: string) => void mockValues.delete(key),
  },
}));
jest.mock('../src/i18n', () => ({ __esModule: true, default: { language: 'en', t: (key: string) => key } }));
jest.mock('../src/auth/session', () => ({
  getSession: () => ({ accounts: mockAccounts, activeId: 'a' }),
  onAccountForgotten: (listener: (id: string) => void) => void mockForgotten.push(listener),
}));
jest.mock('../src/lock/lock', () => ({
  lockEnabled: () => mockLock.enabled,
  onLockChange: (listener: () => void) => {
    mockLock.listeners.push(listener);
    return () => undefined;
  },
}));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, getChat: () => ({ openChannels: [] }) }));
jest.mock('../src/features/chat/api', () => ({
  ChatClient: class {
    account: { id: string };
    constructor(account: { id: string }) {
      this.account = account;
    }
    async setPushPreview(preview: boolean) {
      mockSent.push(`${this.account.id}:${preview}`);
    }
  },
}));

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('message previews follow the app lock', () => {
  it('turns previews off for every signed-in account when the lock is switched on, and back on when it is switched off', async () => {
    require('../src/features/chat/push');
    mockLock.listeners.forEach((listener) => listener());
    await flush();
    expect(mockSent).toEqual([]);
    mockLock.enabled = true;
    mockLock.listeners.forEach((listener) => listener());
    await flush();
    expect(mockSent).toEqual(['a:false', 'b:false']);
    mockLock.enabled = false;
    mockLock.listeners.forEach((listener) => listener());
    await flush();
    expect(mockSent).toEqual(['a:false', 'b:false', 'a:true', 'b:true']);
  });

  it('forgets the preview state of a signed-out device row so a new sign-in sends it again', () => {
    require('../src/features/chat/push');
    mockValues.set('chat.pushPreview.1', 'false');
    mockValues.set('chat.pushPreview.2', 'false');
    mockForgotten.forEach((listener) => listener('a'));
    expect(mockValues.has('chat.pushPreview.1')).toBe(false);
    expect(mockValues.get('chat.pushPreview.2')).toBe('false');
  });
});
