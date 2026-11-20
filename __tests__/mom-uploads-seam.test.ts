const mockForgotten: ((id: string) => void)[] = [];
const mockStore = new Map<string, string>();
const mockDeleted: string[] = [];

jest.mock('../src/auth/session', () => ({
  onAccountForgotten: (listener: (id: string) => void) => mockForgotten.push(listener),
  getSession: () => ({ accounts: [], activeId: null, expired: false, onboarded: true }),
  tokenFor: async () => null,
  markExpired: jest.fn(),
}));
jest.mock('../src/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockStore.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockStore.set(key, value),
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///doc/' }, cache: { uri: 'file:///cache/' } },
  File: class {
    path: string;
    constructor(_root: unknown, path: string) {
      this.path = path;
    }
    get exists() {
      return true;
    }
    delete() {
      mockDeleted.push(this.path);
    }
  },
}));
jest.mock('../src/api/resource', () => ({ invalidate: jest.fn() }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn() }));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: async () => false }));
jest.mock('expo-background-task', () => ({
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
jest.mock('expo-crypto', () => ({ digest: jest.fn(), CryptoDigestAlgorithm: { MD5: 'MD5' } }));

function row(key: string, account: string) {
  return {
    key,
    account,
    programme: { id: 7, name: 'HKR' },
    meeting: { id: 3, name: 'Kickoff' },
    title: key,
    filename: `${key}.m4a`,
    mimetype: 'audio/mp4',
    size: 10,
    file: `Audio/${key}.m4a`,
    durationMs: 1000,
    createdAt: Date.now(),
    etags: {},
    checksums: {},
    state: 'waiting',
    retryAt: Date.now() + 60_000,
    attempts: 1,
  };
}

jest.useFakeTimers();

it('signing out deletes that account recordings and their queue rows, and keeps other accounts', () => {
  mockStore.set('mom.uploads.v1', JSON.stringify([row('a1', 'u1_a'), row('b1', 'u2_b'), row('a2', 'u1_a')]));
  const uploads: typeof import('../src/features/mom/uploads') = require('../src/features/mom/uploads');
  expect(uploads.uploadsOf('u1_a')).toHaveLength(2);
  mockForgotten.forEach((listener) => listener('u1_a'));
  expect(mockDeleted).toEqual(['Audio/a1.m4a', 'Audio/a2.m4a']);
  expect(uploads.uploadsOf('u1_a')).toEqual([]);
  expect(uploads.uploadsOf('u2_b').map((upload) => upload.key)).toEqual(['b1']);
  expect(JSON.parse(mockStore.get('mom.uploads.v1') ?? '[]').map((upload: { key: string }) => upload.key)).toEqual(['b1']);
});

it('gives a 10 MiB part enough time to cross a 64 kbit/s uplink', () => {
  const uploads: typeof import('../src/features/mom/uploads') = require('../src/features/mom/uploads');
  expect(uploads.partDeadlineMs(10 * 1024 * 1024)).toBe(1_340_000);
});
