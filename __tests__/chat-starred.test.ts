import { rpc, route } from '../src/api/odoo';
import { refreshStarred, starredFrom, starredMessages, unstarAll } from '../src/features/chat/starred';
import { setStarredCount } from '../src/features/chat/chat';

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/api/odoo', () => ({ route: jest.fn(), rpc: jest.fn(), bearer: jest.fn(), sessionCookie: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => ({ account: { id: 'u1_a', origin: 'https://lab0.kaitech.io' } }), getChat: () => ({ partnerId: 3 }), patchMessages: jest.fn(), refreshConversations: jest.fn(), setStarredCount: jest.fn(), noteStarToggled: jest.fn() }));

const page = {
  data: {
    'res.partner': [{ id: 4, name: 'Uji Web' }],
    'mail.message': [
      { id: 10, model: 'discuss.channel', res_id: 145, author_id: 4, body: '<p>lama</p>', date: '2026-11-22 01:00:00', message_type: 'comment', attachment_ids: [], starred: true },
      { id: 30, model: 'discuss.channel', res_id: 196, author_id: 4, body: '<p>baru</p>', date: '2026-11-22 03:00:00', message_type: 'comment', attachment_ids: [], starred: true },
      { id: 20, model: 'res.partner', res_id: 4, author_id: 4, body: '<p>chatter</p>', date: '2026-11-22 02:00:00', message_type: 'comment', attachment_ids: [], starred: true },
    ],
  },
  messages: [30, 20, 10],
};

beforeEach(() => {
  jest.mocked(rpc).mockReset();
  jest.mocked(route).mockReset();
  jest.mocked(setStarredCount).mockReset();
});

describe('starred messages', () => {
  it('lists only chat messages, newest first, each with its conversation', () => {
    const list = starredFrom(page, 3);
    expect(list.map((message) => [message.id, message.channelId])).toEqual([
      [30, 196],
      [10, 145],
    ]);
  });

  it('is empty for an answer without data', () => {
    expect(starredFrom(null, 3)).toEqual([]);
  });

  it('counts only my starred chat messages', async () => {
    jest.mocked(rpc).mockResolvedValue(4);
    await refreshStarred();
    expect(jest.mocked(rpc).mock.calls[0].slice(1)).toEqual(['mail.message', 'search_count', [[['starred_partner_ids', 'in', [3]], ['model', '=', 'discuss.channel']]]]);
    expect(setStarredCount).toHaveBeenCalledWith('u1_a', 4);
  });

  it('takes the count from the opened list when the list is complete', async () => {
    jest.mocked(route).mockResolvedValue(page);
    const result = await starredMessages();
    expect(result.ok && result.value.length).toBe(2);
    expect(setStarredCount).toHaveBeenCalledWith('u1_a', 2);
  });

  it('clears the count only after the server removed every star', async () => {
    jest.mocked(rpc).mockRejectedValue(new Error('down'));
    expect((await unstarAll()).ok).toBe(false);
    expect(setStarredCount).not.toHaveBeenCalled();
    jest.mocked(rpc).mockResolvedValue(true);
    expect((await unstarAll()).ok).toBe(true);
    expect(setStarredCount).toHaveBeenCalledWith('u1_a', 0);
  });
});
