const mockForgotten: ((id: string) => void)[] = [];
const mockStore = new Map<string, string>();
const mockFiles = new Set<string>();
const mockDeleted: string[] = [];
const mockAccounts: { id: string; origin: string; db: string }[] = [];
const mockTokens = new Map<string, string>();
const mockCalls: { path: string; body: any }[] = [];
const mockRegister = jest.fn(async (_name: string, _options: unknown) => undefined);
let mockAnswer: (path: string, body: any) => Promise<{ status: number; body: any }> = async () => ({ status: 500, body: null });

jest.mock('../src/auth/session', () => ({
  onAccountForgotten: (listener: (id: string) => void) => mockForgotten.push(listener),
  getSession: () => ({ accounts: mockAccounts, activeId: null, expired: false, onboarded: true }),
  tokenFor: async (id: string) => mockTokens.get(id) ?? null,
  markExpired: jest.fn(),
}));
jest.mock('../src/auth/oauth', () => ({
  headers: () => ({}),
  call: (url: string, init: { body?: string }) => {
    const path = url.replace(/^https:\/\/[^/]+/, '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    mockCalls.push({ path, body });
    return mockAnswer(path, body);
  },
}));
jest.mock('../src/i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockStore.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockStore.set(key, value),
  },
}));
jest.mock('expo-file-system', () => {
  class File {
    path: string;
    constructor(_root: unknown, path: string) {
      this.path = path;
    }
    get name() {
      return this.path.split('/').pop() ?? '';
    }
    get exists() {
      return mockFiles.has(this.path);
    }
    delete() {
      mockFiles.delete(this.path);
      mockDeleted.push(this.path);
    }
    open() {
      return { offset: 0, readBytes: async (length: number) => new Uint8Array(length), close: () => undefined };
    }
  }
  class Directory {
    folder: string;
    constructor(_root: unknown, folder: string) {
      this.folder = folder;
    }
    get exists() {
      return [...mockFiles].some((path) => path.startsWith(`${this.folder}/`));
    }
    list() {
      return [...mockFiles].filter((path) => path.startsWith(`${this.folder}/`)).map((path) => new File(null, path));
    }
  }
  return { Paths: { document: { uri: 'file:///doc/' } }, File, Directory };
});
jest.mock('../src/api/resource', () => ({ invalidate: jest.fn() }));
jest.mock('expo/fetch', () => ({ fetch: async () => ({ ok: true, headers: { get: () => '"e1"' } }) }));
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn() }));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: async () => false }));
jest.mock('expo-background-task', () => ({
  registerTaskAsync: (name: string, options: unknown) => mockRegister(name, options),
  unregisterTaskAsync: jest.fn(async () => undefined),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
jest.mock('expo-crypto', () => ({ digest: async () => new ArrayBuffer(16), CryptoDigestAlgorithm: { MD5: 'MD5' } }));

type Uploads = typeof import('../src/features/mom/uploads');

function row(key: string, account: string, state = 'waiting') {
  return {
    key,
    account,
    programme: { id: 7, name: 'HKR' },
    meeting: { id: 3, name: 'Kickoff' },
    title: key,
    filename: `${key}.m4a`,
    mimetype: 'audio/mp4',
    size: 10,
    file: `Audio/mom-${key}.m4a`,
    durationMs: 1000,
    createdAt: Date.now(),
    sha256: 'f'.repeat(64),
    etags: {},
    checksums: {},
    state,
    retryAt: state === 'waiting' ? Date.now() + 60_000 : undefined,
    attempts: 1,
  };
}

function signIn(...ids: string[]) {
  for (const id of ids) {
    mockAccounts.push({ id, origin: 'https://erp.test', db: 'db' });
    mockTokens.set(id, `token-${id}`);
  }
}

function load(rows: ReturnType<typeof row>[]): Uploads {
  mockStore.set('mom.uploads.v1', JSON.stringify(rows));
  for (const one of rows) mockFiles.add(one.file);
  let uploads!: Uploads;
  jest.isolateModules(() => {
    uploads = require('../src/features/mom/uploads');
  });
  return uploads;
}

function stored(): string[] {
  return JSON.parse(mockStore.get('mom.uploads.v1') ?? '[]').map((one: { key: string }) => one.key);
}

const begun = { recording_id: 5, state: 'uploading', part_bytes: 10, parts: 1, stored: [] };

async function answer(path: string) {
  if (path.endsWith('/mom/upload')) return { status: 200, body: begun };
  if (path.endsWith('/sign')) return { status: 200, body: { parts: [{ number: 1, url: 'https://storage.test/1' }] } };
  if (path.endsWith('/finish')) return { status: 200, body: { recording_id: 5, state: 'uploaded' } };
  return { status: 500, body: null };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockForgotten.length = 0;
  mockStore.clear();
  mockFiles.clear();
  mockDeleted.length = 0;
  mockAccounts.length = 0;
  mockTokens.clear();
  mockCalls.length = 0;
  mockAnswer = answer;
});

it('signing out deletes that account recordings and their queue rows, and keeps other accounts', () => {
  const uploads = load([row('a1', 'u1_a'), row('b1', 'u2_b'), row('a2', 'u1_a')]);
  expect(uploads.uploadsOf('u1_a')).toHaveLength(2);
  mockForgotten.forEach((listener) => listener('u1_a'));
  expect(mockDeleted).toEqual(['Audio/mom-a1.m4a', 'Audio/mom-a2.m4a']);
  expect(uploads.uploadsOf('u1_a')).toEqual([]);
  expect(stored()).toEqual(['b1']);
});

it('sends the rows behind one that waits for its account to sign in again', async () => {
  signIn('u1_a', 'u2_b');
  mockTokens.delete('u1_a');
  const uploads = load([row('a1', 'u1_a', 'signedOut'), row('b1', 'u2_b', 'queued')]);
  await uploads.drain();
  expect(mockCalls.filter((call) => call.path.endsWith('/mom/upload')).map((call) => call.body.key)).toEqual(['b1']);
  expect(uploads.uploadsOf('u2_b').map((upload) => upload.state)).toEqual(['done']);
  expect(uploads.uploadsOf('u1_a').map((upload) => upload.state)).toEqual(['signedOut']);
});

it('keeps a signed-out account gone when its request answers afterwards', async () => {
  signIn('u2_b');
  let release!: () => void;
  mockAnswer = (path) =>
    path.endsWith('/mom/upload') ? new Promise((resolve) => (release = () => resolve({ status: 200, body: begun }))) : answer(path);
  const uploads = load([row('b2', 'u2_b', 'queued')]);
  const draining = uploads.drain();
  await Promise.resolve();
  while (!release) await Promise.resolve();
  mockAccounts.length = 0;
  mockForgotten.forEach((listener) => listener('u2_b'));
  expect(stored()).toEqual([]);
  release();
  await draining;
  expect(uploads.uploadsOf('u2_b')).toEqual([]);
  expect(stored()).toEqual([]);
});

it('deletes meeting recordings no queue row refers to and leaves other audio alone', () => {
  mockFiles.add('Audio/mom-crashed.m4a');
  mockFiles.add('ExpoAudio/mom-crashed-ios.m4a');
  mockFiles.add('Audio/voice-note.m4a');
  load([row('a1', 'u1_a')]);
  expect(mockDeleted.sort()).toEqual(['Audio/mom-crashed.m4a', 'ExpoAudio/mom-crashed-ios.m4a']);
  expect(mockFiles.has('Audio/mom-a1.m4a')).toBe(true);
  expect(mockFiles.has('Audio/voice-note.m4a')).toBe(true);
});

it('starts a part in the background only when it can finish before the budget ends', () => {
  const uploads = load([]);
  const part = 10 * 1024 * 1024;
  expect(uploads.fitsBudget(part, 1_000_000, 9 * 60_000)).toBe(true);
  expect(uploads.fitsBudget(part, 1_000_000, 25_000)).toBe(false);
  expect(uploads.fitsBudget(part, undefined, 9 * 60_000)).toBe(false);
  expect(uploads.fitsBudget(512 * 1024, undefined, 9 * 60_000)).toBe(true);
});

it('gives a 10 MiB part enough time to cross a 64 kbit/s uplink', () => {
  const uploads = load([]);
  expect(uploads.partDeadlineMs(10 * 1024 * 1024)).toBe(1_340_000);
});

it('registers the background task while the first part is still on its way', async () => {
  signIn('u2_b');
  let release!: () => void;
  mockAnswer = (path) =>
    path.endsWith('/mom/upload') ? new Promise((resolve) => (release = () => resolve({ status: 200, body: begun }))) : answer(path);
  const uploads = load([row('b3', 'u2_b', 'queued')]);
  const draining = uploads.drain();
  while (!release) await Promise.resolve();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(mockRegister).toHaveBeenCalledWith('kaitech-mom-uploads', { minimumInterval: 15 });
  release();
  await draining;
});

it('ends the background run at its budget even when a foreground drain is still sending', async () => {
  signIn('u2_b');
  mockAnswer = (path) => (path.endsWith('/mom/upload') ? new Promise(() => undefined) : answer(path));
  const uploads = load([row('b4', 'u2_b', 'queued')]);
  void uploads.drain();
  let ended = false;
  const background = uploads.runInBudget(1_000).then(() => (ended = true));
  await jest.advanceTimersByTimeAsync(1_000);
  await background;
  expect(ended).toBe(true);
});
