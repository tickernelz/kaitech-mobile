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
const mockMessages = jest.fn();
jest.mock('../src/features/chat/api', () => ({
  ChatClient: class {
    constructor() {
      return new Proxy({}, { get: (_target, name) => (name === 'messages' ? mockMessages : async () => ({})) });
    }
  },
  errorCode: () => 'network',
  sendErrorFrom: (error: unknown) => error,
}));

const notice = { id: 950, model: 'discuss.channel', res_id: 12, author_id: 3, body: '<div data-oe-type="call" class="o_mail_notification"></div>', message_type: 'notification' };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function serverHas(history: Record<string, unknown>) {
  mockMessages.mockImplementation(async (_channelId: number, params: { around?: number }) =>
    params.around === 950 ? { data: { 'mail.message': [{ ...notice, call_history_ids: [77] }], 'discuss.call.history': [{ id: 77, start_dt: '2026-11-27 17:20:00', ...history }] } } : { data: {} },
  );
}

async function openThreadWithLiveNotice() {
  const chat = require('../src/features/chat/chat');
  mockMessages.mockResolvedValue({ data: {} });
  chat.startChat({ id: 'u1_a', partnerId: 3, origin: 'https://a.test', db: 'a', userId: 1 });
  chat.openThread(12);
  await flush();
  mockFeed.push?.([{ type: 'discuss.channel/new_message', payload: { id: 12, data: { 'mail.message': [notice] } } }]);
  await flush();
  return () => chat.getChat().threads[12].messages.find((message: { id: number }) => message.id === 950);
}

beforeEach(() => {
  jest.resetModules();
  mockMessages.mockReset();
});

describe('a call notice that arrived while the thread was open', () => {
  it('shows the call as ongoing once Odoo links the call history, then unanswered when the call ends without an answer', async () => {
    const live = await openThreadWithLiveNotice();
    const { callNoticeKey } = require('../src/features/chat/odoo');
    expect(live().call).toBeUndefined();

    serverHas({ duration_hour: 0.001, end_dt: false, kaitech_answered_dt: false });
    mockFeed.push?.([{ type: 'mail.record/insert', payload: { 'mail.message': [{ id: 950, call_history_ids: [77] }], 'discuss.call.history': [{ id: 77 }] } }]);
    await flush();
    expect(live().call).toEqual({ minutes: 0, ongoing: true, answered: false });

    serverHas({ duration_hour: 0.0125, end_dt: '2026-11-27 17:20:45', kaitech_answered_dt: false });
    mockFeed.push?.([{ type: 'mail.record/insert', payload: { 'discuss.call.history': [{ id: 77, duration_hour: 0.0125, end_dt: '2026-11-27 17:20:45' }] } }]);
    await flush();
    expect(live().call).toEqual({ minutes: 1, ongoing: false, answered: false });
    expect(callNoticeKey(live().call, true)).toBe('thread.callUnanswered');
    expect(callNoticeKey(live().call, false)).toBe('thread.callMissed');
  });

  it('counts an answered call from the answer when it ends', async () => {
    const live = await openThreadWithLiveNotice();
    serverHas({ duration_hour: 0.001, end_dt: false, kaitech_answered_dt: false });
    mockFeed.push?.([{ type: 'mail.record/insert', payload: { 'mail.message': [{ id: 950, call_history_ids: [77] }], 'discuss.call.history': [{ id: 77 }] } }]);
    await flush();
    serverHas({ duration_hour: 0.05, end_dt: '2026-11-27 17:23:00', kaitech_answered_dt: '2026-11-27 17:20:30' });
    mockFeed.push?.([{ type: 'mail.record/insert', payload: { 'discuss.call.history': [{ id: 77, duration_hour: 0.05, end_dt: '2026-11-27 17:23:00' }] } }]);
    await flush();
    expect(live().call).toEqual({ minutes: 3, ongoing: false, answered: true });
  });

  it('fetches nothing for a call that ended in a conversation the phone has not loaded', async () => {
    await openThreadWithLiveNotice();
    const before = mockMessages.mock.calls.length;
    mockFeed.push?.([{ type: 'mail.record/insert', payload: { 'discuss.call.history': [{ id: 501, duration_hour: 0.01, end_dt: '2026-11-27 17:20:45' }] } }]);
    await flush();
    expect(mockMessages.mock.calls.length).toBe(before);
  });
});
