import { cannedQuery, gifBody, quickTimes } from '../src/features/chat/composerExtras';
import { createCardStore, isShownWork, linksIn, linksOfMessage, workFrom } from '../src/features/chat/coworker';
import { channelOf } from '../src/features/chat/newConversation';
import { listFilters, matches } from '../src/features/chat/listFilters';
import { channelInfoFromStore, conversationFrom, subChannelsFromStore } from '../src/features/chat/odoo';
import { scheduledFrom } from '../src/features/chat/threadActions';

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/api/odoo', () => ({ route: jest.fn(), rpc: jest.fn(), bearer: jest.fn(), sessionCookie: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, getChat: () => ({ partnerId: 3 }), newKey: () => 'k', patchInfo: jest.fn(), patchMessages: jest.fn(), refreshConversations: jest.fn(), forgetConversation: jest.fn(), setFeatures: jest.fn(), useChat: jest.fn(), notifyTyping: jest.fn(), send: jest.fn() }));

describe('channel info for the thread menu', () => {
  const store = {
    'discuss.channel': [
      { id: 9, name: 'Tim', channel_type: 'channel', member_count: 4, parent_channel_id: false, description: 'Rapat pagi', create_uid: 5, is_editable: true, kaitech_chat_announcement: true, kaitech_chat_pinned: false, kaitech_link: { model: 'ck.engagement', id: 12, name: 'Program A' } },
    ],
    'discuss.channel.member': [
      { id: 1, channel_id: 9, partner_id: 3, custom_notifications: 'mentions', kaitech_chat_role: 'admin' },
      { id: 2, channel_id: 9, partner_id: 4, custom_notifications: 'all', kaitech_chat_role: 'owner' },
    ],
  };

  it('reads my own notification level and role, not another member', () => {
    expect(channelInfoFromStore(store, 9, 3)).toMatchObject({ notifications: 'mentions', role: 'admin', announcement: true, editable: true, description: 'Rapat pagi', createdBy: 5, link: { model: 'ck.engagement', id: 12, name: 'Program A' } });
  });

  it('falls back to the default level and member role when I have no member row', () => {
    expect(channelInfoFromStore(store, 9, 99)).toMatchObject({ notifications: null, role: 'member' });
  });

  it('ignores a link it cannot open', () => {
    const bare = { 'discuss.channel': [{ ...store['discuss.channel'][0], kaitech_link: false }] };
    expect(channelInfoFromStore(bare, 9, 3)?.link).toBeNull();
  });
});

describe('scheduled messages', () => {
  it('lists them in sending order with the server time in UTC', () => {
    const list = scheduledFrom({
      'mail.scheduled.message': [
        { id: 2, body: ['markup', '<p>dua</p>'], scheduled_date: '2026-11-23 02:00:00', attachment_ids: [] },
        { id: 1, body: '<p>satu</p>', scheduled_date: '2026-11-22 01:00:00', attachment_ids: [7] },
      ],
    });
    expect(list.map((item) => item.id)).toEqual([1, 2]);
    expect(list[0]).toEqual({ id: 1, body: '<p>satu</p>', date: Date.UTC(2026, 10, 22, 1), files: 1 });
  });

  it('is empty when nothing is scheduled', () => {
    expect(scheduledFrom({ 'mail.thread': [{ id: 145, scheduledMessages: [] }] })).toEqual([]);
  });
});

describe('Coworker work', () => {
  it('keeps running and recently stopped work and drops finished work', () => {
    const running = workFrom({ turn_id: 1, message_id: 2, channel_id: 3, state: 'running', agent: 'Coworker', asker: 'A', asker_user_id: 5, step: 'Membaca', step_detail: '' });
    expect(running && isShownWork(running)).toBe(true);
    const done = workFrom({ turn_id: 1, message_id: 2, state: 'answered' });
    expect(done && isShownWork(done)).toBe(false);
    expect(workFrom({ message_id: 2 })).toBeNull();
  });
});

describe('record links in a message', () => {
  const origin = 'https://lab0.kaitech.io';

  it('finds links to records on the same server and skips mentions and other sites', () => {
    const html = '<p><a href="/odoo/project.task/5">task</a> <a href="https://lab0.kaitech.io/odoo/action-12/7">x</a> <a href="/odoo/res.partner/3" data-oe-model="res.partner" data-oe-id="3">@Budi</a> <a href="https://example.com/odoo/project.task/1">y</a></p>';
    expect(linksIn(html, origin)).toEqual(['https://lab0.kaitech.io/odoo/project.task/5', 'https://lab0.kaitech.io/odoo/action-12/7']);
  });

  it('returns nothing for a plain message', () => {
    expect(linksIn('<p>halo</p>', origin)).toEqual([]);
  });
});

describe('new conversation answers', () => {
  it('reads the channel id from the data request answer', () => {
    expect(channelOf({ DataResponse: [{ _resolve: true, channel: { id: 145, model: 'discuss.channel' }, id: 1 }] })).toBe(145);
  });

  it('fails loudly when the server did not create a channel', () => {
    expect(() => channelOf({})).toThrow();
  });
});

describe('composer extras', () => {
  it('offers tomorrow morning and next Monday morning', () => {
    const friday = new Date(2026, 10, 20, 15, 0).getTime();
    const times = quickTimes(friday);
    expect(times.map((item) => item.key)).toEqual(['tomorrow', 'monday']);
    expect(new Date(times[0].when).getDate()).toBe(21);
    expect(new Date(times[1].when).getDate()).toBe(23);
    expect(new Date(times[1].when).getHours()).toBe(8);
  });

  it('does not offer Monday twice on a Sunday', () => {
    const sunday = new Date(2026, 10, 22, 15, 0).getTime();
    expect(quickTimes(sunday).map((item) => item.key)).toEqual(['tomorrow']);
  });

  it('starts a canned response only after a space or at the start', () => {
    expect(cannedQuery('::hal', 5)).toEqual({ start: 0, query: 'hal' });
    expect(cannedQuery('a ::x', 5)).toEqual({ start: 2, query: 'x' });
    expect(cannedQuery('a::x', 4)).toBeNull();
    expect(cannedQuery(':: x', 4)).toBeNull();
  });

  it('escapes a GIF link', () => {
    expect(gifBody('https://x.test/a"b.gif')).toBe('<a href="https://x.test/a%22b.gif" target="_blank" rel="noreferrer noopener">https://x.test/a%22b.gif</a>');
  });
});

describe('conversation filters', () => {
  const row = (extra: Record<string, unknown>) => conversationFrom({ id: 1, type: 'channel', name: 'x', unread: 0, activity_at: '2026-11-22 01:00:00', ...extra });

  it('reads the mentioned and agent flags lab0 sends', () => {
    expect(row({ mentioned: true, agent: true })).toMatchObject({ mentioned: true, agent: true });
    expect(row({})).toMatchObject({ mentioned: false, agent: false });
  });

  it('offers Mentions and Coworker only when the server turns them on', () => {
    expect(listFilters(false, true)).toEqual(['all', 'unread', 'people', 'rooms']);
    expect(listFilters(true, false)).toEqual(['all', 'unread', 'mention', 'people', 'rooms']);
    expect(listFilters(true, true)).toContain('agent');
  });

  it('keeps only the matching conversations', () => {
    const mentioned = row({ mentioned: true });
    const coworker = row({ agent: true });
    const plain = row({});
    if (!mentioned || !coworker || !plain) throw new Error('parse');
    expect([mentioned, coworker, plain].filter((item) => matches(item, 'mention'))).toEqual([mentioned]);
    expect([mentioned, coworker, plain].filter((item) => matches(item, 'agent'))).toEqual([coworker]);
  });
});


describe('card store', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('asks once per batch and wakes only the rows whose card arrived', async () => {
    const load = jest.fn(async (keys: number[]) => new Map(keys.filter((key) => key !== 3).map((key) => [key, `card ${key}`])));
    const store = createCardStore<number, string>(load);
    const one = jest.fn();
    const three = jest.fn();
    store.subscribe([1], one);
    store.subscribe([3], three);
    store.want([1, 2, 3]);
    store.want([1, 2]);
    jest.advanceTimersByTime(120);
    await Promise.resolve();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith([1, 2, 3]);
    expect(store.get(1)).toBe('card 1');
    expect(one).toHaveBeenCalledTimes(1);
    expect(three).not.toHaveBeenCalled();
    const before = store.version([3]);
    store.put(1, 'answered');
    expect(store.version([3])).toBe(before);
    expect(store.version([1])).toBeGreaterThan(1);
  });

  it('asks again after a failed load', async () => {
    const load = jest.fn(async () => null);
    const store = createCardStore<number, string>(load);
    store.want([7]);
    jest.advanceTimersByTime(120);
    await Promise.resolve();
    store.want([7]);
    jest.advanceTimersByTime(120);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reads the links of a message once', () => {
    const message = { body: '<a href="/odoo/project.task/5">T</a>' };
    expect(linksOfMessage(message, 'https://lab0.kaitech.io')).toBe(linksOfMessage(message, 'https://lab0.kaitech.io'));
  });
});


describe('sub-threads of a conversation', () => {
  const answer = {
    store_data: {
      'discuss.channel': [
        { id: 398, parent_channel_id: { id: 397, model: 'discuss.channel' }, from_message_id: 15708, name: 'probe induk' },
        { id: 397, parent_channel_id: false, from_message_id: false, name: 'Grup' },
      ],
    },
    sub_channel_ids: [398],
  };

  it('reads the sub-threads the server wraps in store_data, not the parent', () => {
    expect(subChannelsFromStore(answer)).toEqual([{ id: 398, name: 'probe induk', fromMessageId: 15708 }]);
  });

  it('still reads a bare store', () => {
    expect(subChannelsFromStore(answer.store_data).map((sub) => sub.id)).toEqual([398]);
  });
});
