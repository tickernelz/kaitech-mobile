const mockFeed: { push: ((notifications: unknown[]) => void) | null } = { push: null };

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
}));
jest.mock('../src/features/call/native', () => ({ callNative: () => ({ isInPictureInPicture: () => false, isResumed: () => true }), onCallAction: () => () => undefined }));
jest.mock('../src/features/people/photos', () => ({ notePhotos: jest.fn(), notePhotoList: jest.fn() }));
jest.mock('../src/auth/session', () => ({ onAccountForgotten: () => () => undefined, markExpired: jest.fn(), tokenFor: jest.fn(async () => null) }));
jest.mock('../src/api/odoo', () => ({ bearer: jest.fn(), route: jest.fn(), sessionCookie: jest.fn(), onSessionOpened: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/db', () => ({
  allPendingFileUris: () => [],
  cachedConversations: () => [],
  cachedMessages: () => [],
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
jest.mock('expo-crypto', () => ({ randomUUID: () => 'live-key-0000000001' }));
jest.mock('../src/features/chat/realtime', () => ({
  Realtime: class {
    constructor(_client: unknown, onNotifications: (notifications: unknown[]) => void) {
      mockFeed.push = onNotifications;
    }
    start() {
      return undefined;
    }
    stop() {
      return undefined;
    }
    reconnectNow() {
      return undefined;
    }
  },
}));
jest.mock('../src/features/chat/api', () => ({
  ChatClient: class {
    constructor() {
      return new Proxy({}, { get: (_target, name) => (name === 'post' ? () => new Promise(() => undefined) : async () => ({})) });
    }
  },
  errorCode: () => 'network',
  sendErrorFrom: (error: unknown) => error,
}));

describe('a live share confirmed by the bus before the post answers', () => {
  it('still reports the message as delivered so the phone starts sending its position', async () => {
    const chat = require('../src/features/chat/chat');
    const delivered: { messageId: number; key: string }[] = [];
    chat.onDelivered((sent: { messageId: number; pending: { key: string } }) => delivered.push({ messageId: sent.messageId, key: sent.pending.key }));
    chat.startChat({ id: 'u1_a', partnerId: 3, origin: 'https://a.test', db: 'a', userId: 1 });
    const place = { latitude: 1, longitude: 2, accuracy: null, name: '', address: '', live: true, liveUntil: null, liveMinutes: 15, ended: false, endedAt: null, endReason: null, seq: 0, updatedAt: null, map: null };
    const key = await chat.send({ channelId: 12, text: '', parentId: null, mentions: [], files: [], rich: { location: place } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    mockFeed.push?.([
      {
        type: 'discuss.channel/new_message',
        payload: {
          id: 12,
          temporary_id: key,
          data: { 'mail.message': [{ id: 902, model: 'discuss.channel', res_id: 12, author_id: 3, body: 'Live location', message_type: 'comment', kaitech_chat_kind: 'live_location', kaitech_chat_location: { latitude: 1, longitude: 2, live: true } }] },
        },
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(delivered).toEqual([{ messageId: 902, key }]);
  });
});
