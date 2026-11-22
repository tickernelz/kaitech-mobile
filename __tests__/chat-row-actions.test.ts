const mockCalls: { account: string; method: string; args: unknown[] }[] = [];
const mockFail = new Set<string>();
const mockDropped: [string, number][] = [];

function mockPage(pinned: boolean | undefined) {
  const row = (id: number, activity: string, extra: Record<string, unknown> = {}) => ({
    id,
    type: id === 4 ? 'chat' : 'group',
    name: `Room ${id}`,
    unread: 0,
    activity_at: activity,
    last_message: { id: id * 10, author_id: 9, author: 'Budi', text: 'halo', attachments: 0, date: activity },
    ...(pinned === undefined ? {} : { pinned: id === 5 ? pinned : false, archived: false }),
    ...extra,
  });
  return { conversations: [row(4, '2026-11-21 10:00:00'), row(5, '2026-11-20 09:00:00')], next_cursor: null, archived_count: 2, archived_unread: 1 };
}

jest.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { currentState: 'background', addEventListener: () => ({ remove: () => undefined }) } }));
jest.mock('../src/features/call/native', () => ({ callNative: () => ({ isInPictureInPicture: () => false, isResumed: () => true }), onCallAction: () => () => undefined }));
jest.mock('../src/features/people/photos', () => ({ notePhotos: jest.fn(), notePhotoList: jest.fn() }));
jest.mock('../src/auth/session', () => ({ onAccountForgotten: () => () => undefined, markExpired: jest.fn(), tokenFor: jest.fn(async () => null) }));
jest.mock('../src/features/chat/db', () => ({
  allPendingFileUris: () => [],
  cachedConversations: () => [],
  cachedMessages: () => [],
  dropConversation: async (account: string, id: number) => {
    mockDropped.push([account, id]);
  },
  forgetAccount: jest.fn(),
  pendingFor: () => [],
  removePending: jest.fn(),
  savePending: jest.fn(),
  storeConversations: jest.fn(),
  storeMessages: jest.fn(),
  cachedDraft: () => null,
  storeDraft: jest.fn(),
}));
jest.mock('../src/features/chat/files', () => ({ dropFile: jest.fn(), sweepStaging: jest.fn(), clearOpenedFiles: jest.fn(), localFile: jest.fn() }));
jest.mock('expo-network', () => ({ addNetworkStateListener: () => ({ remove: () => undefined }), getNetworkStateAsync: async () => ({ isConnected: true }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('../src/features/chat/realtime', () => ({ Realtime: class { start() {} stop() {} reconnectNow() {} } }));
jest.mock('../src/features/chat/api', () => ({
  ChatClient: class {
    constructor(account: { id: string }) {
      return new Proxy(
        {},
        {
          get: (_target, method: string) => async (...args: unknown[]) => {
            mockCalls.push({ account: account.id, method, args });
            if (mockFail.has(method)) throw new Error('down');
            if (method === 'conversations') return mockPage(account.id === 'u1_a' ? true : undefined);
            if (method === 'pin') return args[1];
            return {};
          },
        },
      );
    }
  },
  errorCode: () => 'network',
  sendErrorFrom: (error: unknown) => error,
}));

const chat = require('../src/features/chat/chat') as typeof import('../src/features/chat/chat');
const undo = require('../src/ui/undo') as typeof import('../src/ui/undo');

const accountA = { id: 'u1_a', partnerId: 3, origin: 'https://a.test', db: 'a', userId: 1 };
const accountB = { id: 'u2_b', partnerId: 8, origin: 'https://b.test', db: 'b', userId: 2 };

async function settle() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

async function start(account: typeof accountA) {
  chat.startChat(account as never);
  await settle();
  await chat.refreshConversations();
}

function ids() {
  return chat.getChat().conversations.map((item) => item.id);
}

function calls(method: string) {
  return mockCalls.filter((call) => call.method === method);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockCalls.length = 0;
  mockFail.clear();
  mockDropped.length = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('conversation row actions', () => {
  it('lists a pinned conversation first and reads the archive summary', async () => {
    await start(accountA);
    expect(ids()).toEqual([5, 4]);
    expect(chat.getChat().archivedSummary).toEqual({ count: 2, unread: 1 });
  });

  it('marks unread at the last message and marks read again', async () => {
    await start(accountA);
    expect(await chat.setConversationRead(4, false)).toBeNull();
    expect(calls('markUnread').at(-1)?.args).toEqual([4, 40]);
    expect(chat.getChat().conversations.find((item) => item.id === 4)?.unread).toBe(1);
    expect(await chat.setConversationRead(4, true)).toBeNull();
    expect(calls('markAsRead').at(-1)?.args).toEqual([4, 40]);
    expect(chat.getChat().conversations.find((item) => item.id === 4)?.unread).toBe(0);
  });

  it('puts the unread count back when the server refuses', async () => {
    await start(accountA);
    mockFail.add('markUnread');
    expect(await chat.setConversationRead(4, false)).toBe('network');
    expect(chat.getChat().conversations.find((item) => item.id === 4)?.unread).toBe(0);
  });

  it('removes a conversation at once and sends nothing until the undo window passes', async () => {
    await start(accountA);
    const removal = chat.removalOf(4, 'hide');
    if (!removal) throw new Error('no removal');
    undo.deferUndoable({ label: 'Removed', ...removal });
    expect(ids()).toEqual([5]);
    await chat.refreshConversations();
    expect(ids()).toEqual([5]);
    expect(calls('hide')).toHaveLength(0);
    jest.advanceTimersByTime(undo.undoWindowMs);
    await settle();
    expect(calls('hide').map((call) => call.args)).toEqual([[4]]);
    expect(mockDropped).toEqual([['u1_a', 4]]);
  });

  it('brings the conversation back on undo and never calls the server', async () => {
    await start(accountA);
    const removal = chat.removalOf(5, 'leave');
    if (!removal) throw new Error('no removal');
    undo.deferUndoable({ label: 'Left', ...removal });
    expect(ids()).toEqual([4]);
    undo.undoLast();
    expect(ids()).toEqual([5, 4]);
    jest.advanceTimersByTime(undo.undoWindowMs * 2);
    await settle();
    expect(calls('leave')).toHaveLength(0);
  });

  it('brings the conversation back and says so when the server refuses', async () => {
    await start(accountA);
    mockFail.add('hide');
    const removal = chat.removalOf(4, 'hide');
    if (!removal) throw new Error('no removal');
    undo.deferUndoable({ label: 'Removed', ...removal });
    jest.advanceTimersByTime(undo.undoWindowMs);
    await settle();
    expect(ids()).toEqual([5, 4]);
    expect(mockDropped).toHaveLength(0);
  });

  it('sends a pending removal as the account that asked, not the one active later', async () => {
    await start(accountA);
    const removal = chat.removalOf(4, 'hide');
    if (!removal) throw new Error('no removal');
    undo.deferUndoable({ label: 'Removed', ...removal });
    await start(accountB);
    jest.advanceTimersByTime(undo.undoWindowMs);
    await settle();
    expect(calls('hide').map((call) => call.account)).toEqual(['u1_a']);
    expect(mockDropped).toEqual([['u1_a', 4]]);
  });

  it('does not offer pin or archive while the server does not report them', async () => {
    await start(accountB);
    const listed = chat.getChat().conversations.find((item) => item.id === 4);
    expect(listed?.pinned).toBeNull();
    expect(listed?.archived).toBeNull();
    expect(await chat.setConversationPinned(4, true)).toBe('unavailable');
    expect(calls('pin')).toHaveLength(0);
  });
});
