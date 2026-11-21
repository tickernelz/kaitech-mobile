const mockStore = new Map<string, string>();
const mockForget: ((id: string) => void)[] = [];
const mockGone = new Set<string>();
let mockAnswer: (value: unknown) => void = () => undefined;

jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: (key: string) => mockStore.get(key) ?? null,
  setItemSync: (key: string, value: string) => mockStore.set(key, value),
  removeItemSync: (key: string) => mockStore.delete(key),
}));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('../src/features/media/shrink', () => ({ shrinkToJpeg: jest.fn() }));
jest.mock('../src/auth/session', () => ({
  onAccountForgotten: (listener: (id: string) => void) => mockForget.push(listener),
  accountKnown: (id: string) => !mockGone.has(id),
  renameAccount: jest.fn(),
  useSession: () => ({ active: null }),
}));
jest.mock('../src/api/odoo', () => ({ bearer: () => new Promise((resolve) => (mockAnswer = resolve)), bearerFile: jest.fn() }));
jest.mock('../src/features/chat/api', () => ({ errorCode: () => 'unknown' }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, onRealtimeNotifications: () => () => undefined }));

const { refreshProfile } = require('../src/features/profile/profile') as typeof import('../src/features/profile/profile');
const { partnerPhoto } = require('../src/features/people/photos') as typeof import('../src/features/people/photos');

describe('a profile answer after sign-out', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('leaves no photo or appearance of the forgotten account behind', async () => {
    const loading = refreshProfile({ id: 'A' } as never);
    mockForget.forEach((listener) => listener('A'));
    mockGone.add('A');
    mockAnswer({
      user_id: 9,
      partner_id: 7,
      name: 'Budi',
      login: 'budi',
      photo: { version: 'v1', small: '/web/image/res.partner/7/avatar_128?unique=v1' },
      appearance: { theme: 'dark', background: { kind: 'default' }, conversations: {} },
    });
    await loading;
    jest.advanceTimersByTime(5000);
    expect([...mockStore.keys()]).toEqual([]);
    expect(partnerPhoto('A', 7)).toBeUndefined();
  });
});
