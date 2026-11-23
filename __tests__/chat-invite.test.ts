import { rpc } from '../src/api/odoo';
import { patchInfo } from '../src/features/chat/chat';
import { invite } from '../src/features/chat/threadActions';

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/api/odoo', () => ({ route: jest.fn(), rpc: jest.fn(), bearer: jest.fn(), sessionCookie: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/chat', () => ({
  chatClient: () => ({ account: { origin: 'https://lab0.kaitech.io' } }),
  getChat: () => ({ partnerId: 3 }),
  threadOf: () => ({ info: { memberCount: 2 } }),
  patchInfo: jest.fn(),
  refreshConversations: jest.fn(),
  forgetConversation: jest.fn(),
  setFeatures: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(rpc).mockReset();
  jest.mocked(patchInfo).mockReset();
});

describe('inviting people into a conversation', () => {
  it('counts the invited people in the header once the server added them', async () => {
    jest.mocked(rpc).mockResolvedValue(true);
    expect((await invite(146, [1150, 1151])).ok).toBe(true);
    expect(patchInfo).toHaveBeenCalledWith(146, { memberCount: 4 });
  });

  it('keeps the count when the server refused', async () => {
    jest.mocked(rpc).mockRejectedValue(new Error('forbidden'));
    expect((await invite(146, [1150])).ok).toBe(false);
    expect(patchInfo).not.toHaveBeenCalled();
  });
});
