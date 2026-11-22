const mockCalls: { method: string; args: unknown[] }[] = [];
const mockPages: { resolve: (body: unknown) => void; cursor: unknown }[] = [];
let mockNotify: (notifications: unknown[]) => void = () => undefined;

jest.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { currentState: 'background', addEventListener: () => ({ remove: () => undefined }) } }));
jest.mock('../src/features/call/native', () => ({ callNative: () => ({ isInPictureInPicture: () => false, isResumed: () => true }), onCallAction: () => () => undefined }));
jest.mock('../src/features/people/photos', () => ({ notePhotos: jest.fn(), notePhotoList: jest.fn() }));
jest.mock('../src/auth/session', () => ({ onAccountForgotten: () => () => undefined, markExpired: jest.fn(), tokenFor: jest.fn(async () => null) }));
jest.mock('../src/features/chat/db', () => ({
  allPendingFileUris: () => [],
  cachedConversations: () => [],
  cachedMessages: () => [],
  dropConversation: jest.fn(),
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
jest.mock('../src/api/odoo', () => ({ bearer: jest.fn(), route: jest.fn(), rpc: jest.fn(), sessionCookie: jest.fn(), onSessionOpened: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/realtime', () => ({
  Realtime: class {
    constructor(_client: unknown, onNotifications: (notifications: unknown[]) => void) {
      mockNotify = onNotifications;
    }
    start() {}
    stop() {}
    reconnectNow() {}
  },
}));
jest.mock('../src/features/chat/api', () => ({
  ChatClient: class {
    constructor() {
      return new Proxy(
        {},
        {
          get: (_target, method: string) => (...args: unknown[]) => {
            mockCalls.push({ method, args });
            if (method === 'conversations') return new Promise((resolve) => mockPages.push({ resolve, cursor: args[0] }));
            return Promise.resolve({});
          },
        },
      );
    }
  },
  errorCode: () => 'network',
  sendErrorFrom: (error: unknown) => error,
}));

const chat = require('../src/features/chat/chat') as typeof import('../src/features/chat/chat');

const account = { id: 'u1_a', partnerId: 3, origin: 'https://a.test', db: 'a', userId: 1 };

function row(id: number, activity: string) {
  return {
    id,
    type: id === 7 ? 'chat' : 'group',
    name: `Room ${id}`,
    unread: 0,
    activity_at: activity,
    last_message: { id: id * 10, author_id: 9, author: 'Budi', text: 'halo', attachments: 0, date: activity },
  };
}

async function settle() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

function conversationCalls() {
  return mockCalls.filter((call) => call.method === 'conversations').map((call) => call.args[0]);
}

function newMessage(channelId: number, messageId: number) {
  return {
    type: 'discuss.channel/new_message',
    payload: {
      id: channelId,
      data: {
        'mail.message': [{ id: messageId, model: 'discuss.channel', res_id: channelId, author_id: 9, date: '2026-11-22 10:05:00', body: '<p>kembali</p>', message_type: 'comment' }],
        'res.partner': [{ id: 9, name: 'Budi' }],
      },
    },
  };
}

test('a message for a hidden chat that arrives while the list is loading still brings the chat back', async () => {
  chat.startChat(account as never);
  await settle();
  mockPages.shift()?.resolve({ conversations: [row(4, '2026-11-22 09:00:00')], next_cursor: 'page-2', archived_count: 0, archived_unread: 0 });
  await settle();

  const more = chat.loadMoreConversations();
  await settle();
  mockNotify([newMessage(7, 701)]);
  await settle();
  mockPages.shift()?.resolve({ conversations: [row(5, '2026-11-20 09:00:00')], next_cursor: null, archived_count: 0, archived_unread: 0 });
  await more;
  await settle();

  expect(conversationCalls()).toEqual([null, 'page-2', null]);
  mockPages.shift()?.resolve({ conversations: [row(7, '2026-11-22 10:05:00'), row(4, '2026-11-22 09:00:00')], next_cursor: null, archived_count: 0, archived_unread: 0 });
  await settle();
  expect(chat.getChat().conversations.map((item) => item.id)).toEqual([7, 4]);
});
