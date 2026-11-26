import { ApiError } from '../src/api/odoo';
import { chosenBy, closePoll, nextChoice, vote, withVote } from '../src/features/chat/polls';
import type { Message, Poll } from '../src/features/chat/types';

const mockRoute = jest.fn();
let mockMessages: Message[] = [];
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/api/odoo', () => {
  class ApiError extends Error {
    constructor(code: string, status: number, detail: string | null = null, reason: string | null = null) {
      super(code);
      Object.assign(this, { code, status, detail, reason });
    }
  }
  return { route: (...args: unknown[]) => mockRoute(...args), rpc: jest.fn(), ApiError };
});
jest.mock('../src/features/chat/chat', () => ({
  chatClient: () => ({ account: { id: 'a' } }),
  getChat: () => ({ partnerId: 7, threads: { 12: { messages: mockMessages } } }),
  patchMessages: (patches: Map<number, Partial<Message>>) => {
    mockMessages = mockMessages.map((message) => (patches.has(message.id) ? { ...message, ...patches.get(message.id) } : message));
  },
  noteStarToggled: jest.fn(),
  refreshConversations: jest.fn(),
}));


const poll: Poll = {
  question: 'Lunch where?',
  multiple: false,
  closed: false,
  closedAt: null,
  votersCount: 2,
  options: [
    { id: 41, label: 'Padang', votes: 1, voters: [{ id: 7, name: 'Ana' }] },
    { id: 42, label: 'Sushi', votes: 1, voters: [{ id: 3, name: 'Citra' }] },
  ],
};

function message(rich: Poll): Message {
  return { id: 901, channelId: 12, authorId: 3, author: 'Citra', body: '', date: 0, type: 'comment', attachments: [], parentId: null, reactions: [], rich: { poll: rich } };
}

const shown = () => {
  const rich = mockMessages[0].rich;
  return rich && 'poll' in rich ? rich.poll : null;
};

describe('choosing in a poll', () => {
  it('moves a single choice and lets the voter take it back', () => {
    expect(nextChoice(poll, [41], 42)).toEqual([42]);
    expect(nextChoice(poll, [41], 41)).toEqual([]);
    expect(nextChoice({ ...poll, multiple: true }, [41], 42)).toEqual([41, 42]);
  });

  it('counts a person once however many options they pick and drops them when they retract', () => {
    const many = { ...poll, multiple: true };
    const both = withVote(many, 7, [41, 42]);
    expect(both.options.map((option) => option.votes)).toEqual([1, 2]);
    expect(both.votersCount).toBe(2);
    const none = withVote(both, 7, []);
    expect(none.options.map((option) => option.votes)).toEqual([0, 1]);
    expect(none.votersCount).toBe(1);
    expect(chosenBy(none, 7)).toEqual([]);
  });

  it('counts a new voter', () => {
    expect(withVote(poll, 99, [42]).votersCount).toBe(3);
  });
});

describe('vote and close through the server', () => {
  beforeEach(() => {
    mockRoute.mockReset();
    mockMessages = [message(poll)];
  });

  it('shows the vote at once, sends only the option ids, and takes the server result', async () => {
    let answer: (value: unknown) => void = () => undefined;
    mockRoute.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const result = vote({ id: 901, channelId: 12 }, [42]);
    expect(chosenBy(shown()!, 7)).toEqual([42]);
    answer({ store_data: { 'res.partner': [{ id: 7, name: 'Ana' }], 'mail.message': [{ id: 901, kaitech_chat_kind: 'poll', kaitech_chat_poll: { question: 'Lunch where?', multiple: false, voters_count: 2, options: [{ id: 41, label: 'Padang', votes: 0, voter_ids: [] }, { id: 42, label: 'Sushi', votes: 2, voter_ids: [3, 7] }] } }] } });
    expect(await result).toEqual({ ok: true, value: null });
    expect(mockRoute).toHaveBeenCalledWith({ id: 'a' }, '/kaitech_chat/poll/vote', { message_id: 901, option_ids: [42] });
    expect(shown()!.options[1].voters).toEqual([{ id: 3, name: '' }, { id: 7, name: 'Ana' }]);
  });

  it('puts the old choice back and reports closed when the poll closed meanwhile', async () => {
    mockRoute.mockRejectedValue(new ApiError('refused', 200, 'This poll is closed.', 'closed'));
    const result = await vote({ id: 901, channelId: 12 }, [42]);
    expect(result).toMatchObject({ ok: false, reason: 'closed' });
    expect(chosenBy(shown()!, 7)).toEqual([41]);
    expect(shown()!.options.map((option) => option.votes)).toEqual([1, 1]);
  });

  it('keeps the old choice when the phone is offline', async () => {
    mockRoute.mockRejectedValue(new Error('offline'));
    const result = await vote({ id: 901, channelId: 12 }, []);
    expect(result.ok).toBe(false);
    expect(chosenBy(shown()!, 7)).toEqual([41]);
  });

  it('closes a poll and shows it closed from the answer', async () => {
    mockRoute.mockResolvedValue({ store_data: { 'mail.message': [{ id: 901, kaitech_chat_kind: 'poll', kaitech_chat_poll: { question: 'Lunch where?', closed: true, closed_at: '2026-11-25 06:00:00', options: [{ id: 41, label: 'Padang', votes: 1, voter_ids: [7] }] } }] } });
    expect(await closePoll({ id: 901 })).toEqual({ ok: true, value: null });
    expect(mockRoute).toHaveBeenCalledWith({ id: 'a' }, '/kaitech_chat/poll/close', { message_id: 901 });
    expect(shown()).toMatchObject({ closed: true, closedAt: Date.UTC(2026, 10, 25, 6, 0, 0) });
  });
});
