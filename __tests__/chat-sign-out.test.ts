import type { Pending } from '../src/features/chat/types';

const mockForgotten: ((id: string) => void)[] = [];
const mockDropFile = jest.fn();
const mockForgetAccount = jest.fn(async () => undefined);
const mockQueued: Pending = {
  key: 'm1',
  accountId: 'u7_abc',
  channelId: 4,
  text: '',
  parentId: null,
  mentions: [],
  files: [{ key: 'f1', uri: 'chat-outbox/u1/voice.m4a', name: 'voice.m4a', mimetype: 'audio/mp4', size: 3, voice: true, durationMs: 900, attachmentId: null, ownershipToken: null }],
  createdAt: 0,
  attempts: 0,
  state: 'queued',
  error: null,
};

jest.mock('../src/features/people/photos', () => ({ notePhotos: jest.fn(), notePhotoList: jest.fn() }));
jest.mock('../src/auth/session', () => ({
  onAccountForgotten: (listener: (id: string) => void) => {
    mockForgotten.push(listener);
    return () => undefined;
  },
  markExpired: jest.fn(),
  tokenFor: jest.fn(async () => null),
}));
jest.mock('../src/api/odoo', () => ({ bearer: jest.fn(), route: jest.fn(), sessionCookie: jest.fn(), onSessionOpened: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/db', () => ({
  allPendingFileUris: () => [],
  cachedConversations: () => [],
  cachedMessages: () => [],
  forgetAccount: mockForgetAccount,
  pendingFor: (id: string) => (id === 'u7_abc' ? [mockQueued] : []),
  removePending: jest.fn(),
  savePending: jest.fn(),
  storeConversations: jest.fn(),
  storeMessages: jest.fn(),
  cachedDraft: () => null,
  storeDraft: jest.fn(),
}));
jest.mock('../src/features/chat/files', () => ({ dropFile: mockDropFile, sweepStaging: jest.fn(), clearOpenedFiles: jest.fn(), localFile: jest.fn() }));
jest.mock('expo-network', () => ({ addNetworkStateListener: () => ({ remove: () => undefined }), getNetworkStateAsync: async () => ({ isConnected: true }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));

describe('signing out through the session', () => {
  it('deletes the staged files of the account and then its chat rows', async () => {
    require('../src/features/chat/chat');
    expect(mockForgotten.length).toBeGreaterThan(0);
    mockForgotten.forEach((listener) => listener('u7_abc'));
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockDropFile).toHaveBeenCalledWith('chat-outbox/u1/voice.m4a');
    expect(mockForgetAccount).toHaveBeenCalledWith('u7_abc');
    expect(mockDropFile.mock.invocationCallOrder[0]).toBeLessThan(mockForgetAccount.mock.invocationCallOrder[0]);
  });
});
