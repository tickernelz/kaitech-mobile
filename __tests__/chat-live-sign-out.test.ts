const mockSecure = new Map<string, string>();
const mockKv = new Map<string, string>();
const mockRequests: string[] = [];

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItemAsync: async (key: string) => mockSecure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void mockSecure.set(key, value),
  deleteItemAsync: async (key: string) => void mockSecure.delete(key),
}));
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockKv.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockKv.set(key, value),
    removeItemSync: (key: string) => mockKv.delete(key),
  },
}));
jest.mock('expo-file-system', () => ({ File: class {}, UploadType: {} }));
jest.mock('../src/lock/lock', () => ({ resetLock: jest.fn() }));
jest.mock('../src/i18n', () => ({ __esModule: true, default: { language: 'en', getFixedT: () => (key: string) => key } }));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  ActivityType: { Other: 1 },
  hasStartedLocationUpdatesAsync: async () => false,
  startLocationUpdatesAsync: async () => undefined,
  stopLocationUpdatesAsync: async () => undefined,
  watchPositionAsync: async () => ({ remove: () => undefined }),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('react-native', () => ({ AppState: { currentState: 'background', addEventListener: () => ({ remove: () => undefined }) } }));
jest.mock('../src/ui/permission', () => ({ askPermission: jest.fn() }));
jest.mock('../src/features/chat/messageActions', () => ({ run: jest.fn() }));
jest.mock('../src/features/chat/chat', () => ({ getChat: () => null, patchMessages: jest.fn(), onDelivered: jest.fn() }));

global.fetch = jest.fn(async (url: string) => {
  mockRequests.push(new URL(url).pathname);
  const body = url.endsWith('/kaitech_mobile/session') ? { session_id: 's1', expires_in: 3600 } : { jsonrpc: '2.0', result: { store_data: {} } };
  return { status: 200, text: async () => JSON.stringify(body) } as Response;
}) as typeof fetch;

const { addAccount, removeAccount, signOut } = require('../src/auth/session') as typeof import('../src/auth/session');
const { liveShares, trackShare } = require('../src/features/chat/live') as typeof import('../src/features/chat/live');
require('../src/features/chat/liveTask');

const grant = { token: 't', deviceId: 3, userId: 1, partnerId: 7, db: 'lab0', name: 'Ana', login: 'ana' };

beforeEach(() => {
  mockRequests.length = 0;
});

describe('leaving an account that shares its live location', () => {
  it('stops the share on the server before the account is removed', async () => {
    const account = await addAccount('https://lab0.test', grant as never);
    trackShare(account.id, { messageId: 902, channelId: 12, until: Date.now() + 60000 });
    await removeAccount(account.id);
    expect(mockRequests).toContain('/kaitech_chat/location/stop');
    expect(liveShares(account.id)).toEqual([]);
  });

  it('stops the share before the device is revoked on sign-out', async () => {
    const account = await addAccount('https://lab0.test', grant as never);
    trackShare(account.id, { messageId: 903, channelId: 12, until: Date.now() + 60000 });
    await signOut(account.id);
    const stop = mockRequests.indexOf('/kaitech_chat/location/stop');
    const revoke = mockRequests.findIndex((path) => path.endsWith('/revoke'));
    expect(stop).toBeGreaterThanOrEqual(0);
    expect(stop).toBeLessThan(revoke);
    expect(liveShares(account.id)).toEqual([]);
  });
});
