const mockAppListeners: ((state: string) => void)[] = [];
const mockRealtime = { starts: 0, stops: 0 };
let mockPip = false;

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    currentState: 'active',
    addEventListener: (_type: string, listener: (state: string) => void) => {
      mockAppListeners.push(listener);
      return { remove: () => undefined };
    },
  },
}));
const mockCallActions: ((action: { type: string; active?: boolean }) => void)[] = [];
let mockResumed = true;
jest.mock('../src/features/call/native', () => ({
  callNative: () => ({ isInPictureInPicture: () => mockPip, isResumed: () => mockResumed }),
  onCallAction: (listener: (action: { type: string; active?: boolean }) => void) => {
    mockCallActions.push(listener);
    return () => undefined;
  },
}));
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
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('../src/features/chat/realtime', () => ({
  Realtime: class {
    start() {
      mockRealtime.starts += 1;
    }
    stop() {
      mockRealtime.stops += 1;
    }
    reconnectNow() {
      return undefined;
    }
  },
}));
jest.mock('../src/features/chat/api', () => ({
  ChatClient: class {
    constructor() {
      return new Proxy({}, { get: () => async () => ({}) });
    }
  },
  errorCode: () => 'network',
  sendErrorFrom: (error: unknown) => error,
}));

function pipEnded(resumed: boolean) {
  mockPip = false;
  mockResumed = resumed;
  mockCallActions.forEach((listener) => listener({ type: 'pip', active: false }));
}

function emit(state: string, pip: boolean) {
  mockPip = pip;
  mockAppListeners.forEach((listener) => listener(state));
}

describe('chat presence while a call sits in picture-in-picture', () => {
  it('stays away from the open chat until the window is expanded', () => {
    const chat = require('../src/features/chat/chat');
    chat.startChat({ id: 'u1_a', partnerId: 3, origin: 'https://a.test', db: 'a', userId: 1 });
    expect(mockRealtime.starts).toBe(1);
    emit('background', false);
    expect(mockRealtime.stops).toBe(1);
    emit('active', true);
    expect(mockRealtime.starts).toBe(1);
    emit('active', false);
    expect(mockRealtime.starts).toBe(2);
  });

  it('comes back when the window mode ends after the resume was reported', () => {
    emit('background', false);
    const stops = mockRealtime.stops;
    const starts = mockRealtime.starts;
    expect(stops).toBeGreaterThan(0);
    emit('active', true);
    expect(mockRealtime.starts).toBe(starts);
    pipEnded(true);
    expect(mockRealtime.starts).toBe(starts + 1);
  });
});
