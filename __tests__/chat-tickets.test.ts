const mockStore = new Map<string, { id: number }[]>();
let mockAccount = 'a';
jest.mock('../src/features/chat/db', () => ({
  cachedTickets: (account: string) => mockStore.get(account) ?? [],
  storeTickets: (account: string, tickets: { id: number }[]) => {
    const kept = (mockStore.get(account) ?? []).filter((item) => !tickets.some((ticket) => ticket.id === item.id));
    mockStore.set(account, [...tickets, ...kept]);
  },
  dropTicket: (account: string, id: number) => mockStore.set(account, (mockStore.get(account) ?? []).filter((item) => item.id !== id)),
}));
jest.mock('../src/features/chat/messageActions', () => ({
  run: async <T>(work: (account: { id: string }) => Promise<T>) => {
    try {
      return { ok: true, value: await work({ id: mockAccount }) };
    } catch (error) {
      return { ok: false, code: (error as { code?: string }).code ?? 'unknown', detail: null };
    }
  },
}));
jest.mock('../src/api/odoo', () => ({ rpc: jest.fn() }));

import { rpc } from '../src/api/odoo';
import { lastSteps, noticeTicket, offlineTicket, onTicketNotice, questionFrom, readTicket, ticketDetail, ticketFrom } from '../src/features/chat/tickets';

const raw = {
  id: 7,
  number: 'TK-7',
  name: 'Review requirement pembelian',
  state: 'blocked',
  requester: 'Ani',
  requester_user_id: 5,
  card_message_id: 90,
  checkpoints: [
    { id: 3, seq: 3, kind: 'question', body: 'Proses mana dulu?', actor: 'Coworker', at: '2026-11-28 05:00:00' },
    { id: 1, seq: 1, kind: 'state', body: 'Opened for Ani.', actor: 'Coworker', at: '2026-11-28 04:58:00' },
  ],
  question: { id: 11, question: 'Proses mana dulu?', recommendation: 'Pembelian', options: [{ id: 1, label: 'Pembelian', recommended: true }, { id: 2, label: 'Penjualan' }], state: 'open', can_answer: false },
  answerers: ['Ani'],
  can_decide: false,
  live_turn_ids: [],
};

beforeEach(() => {
  mockStore.clear();
  mockAccount = 'a';
  (rpc as jest.Mock).mockReset();
});

describe('ticket cards from the server', () => {
  it('orders checkpoints oldest first and keeps who may decide', () => {
    const ticket = ticketFrom(raw);
    expect(ticket?.checkpoints.map((step) => step.seq)).toEqual([1, 3]);
    expect(ticket?.state).toBe('blocked');
    expect(ticket?.canDecide).toBe(false);
    expect(ticket?.question?.options.map((option) => [option.label, option.recommended])).toEqual([
      ['Pembelian', true],
      ['Penjualan', false],
    ]);
  });

  it('leaves status lines, written in the server language, to the status chip and shows what the agents did', () => {
    const ticket = ticketFrom({ ...raw, checkpoints: [...raw.checkpoints, { id: 4, seq: 4, kind: 'state', body: 'Waiting for Ani to answer.', actor: 'Coworker', at: '2026-11-28 05:00:01' }] });
    expect(ticket && lastSteps(ticket, 1).map((step) => step.body)).toEqual(['Proses mana dulu?']);
    expect(ticket && lastSteps({ ...ticket, checkpoints: ticket.checkpoints.filter((step) => step.kind === 'state') }, 1)).toEqual([]);
  });

  it('refuses rows without an id and an unknown state reads as in progress', () => {
    expect(ticketFrom({ number: 'TK-1' })).toBeNull();
    expect(questionFrom(null)).toBeNull();
    expect(ticketFrom({ ...raw, state: 'weird' })?.state).toBe('progress');
  });
});

describe('the last ticket read stays per account', () => {
  it('shows a ticket offline only to the account that read it', async () => {
    (rpc as jest.Mock).mockResolvedValueOnce(raw);
    await ticketDetail(7);
    expect(offlineTicket('a', 7)?.number).toBe('TK-7');
    expect(offlineTicket('b', 7)).toBeNull();
  });

  it('falls back to the stored copy only when the phone is offline', async () => {
    (rpc as jest.Mock).mockResolvedValueOnce(raw);
    await ticketDetail(7);
    (rpc as jest.Mock).mockRejectedValueOnce({ code: 'network' });
    expect(await readTicket('a', 7)).toEqual({ ticket: expect.objectContaining({ number: 'TK-7' }) });
    (rpc as jest.Mock).mockRejectedValueOnce({ code: 'server' });
    expect(await readTicket('a', 7)).toBeNull();
    expect(offlineTicket('a', 7)?.number).toBe('TK-7');
  });

  it.each(['forbidden', 'not_found'])('forgets the stored copy once the server answers %s', async (code) => {
    (rpc as jest.Mock).mockResolvedValueOnce(raw);
    await ticketDetail(7);
    (rpc as jest.Mock).mockRejectedValueOnce({ code });
    expect(await readTicket('a', 7)).toEqual({ gone: true });
    expect(offlineTicket('a', 7)).toBeNull();
    (rpc as jest.Mock).mockRejectedValueOnce({ code: 'network' });
    expect(await readTicket('a', 7)).toBeNull();
  });
});

describe('live notices', () => {
  it('reaches the card of that ticket only', () => {
    const seen: number[] = [];
    const stop = onTicketNotice((notice) => seen.push(notice.ticketId));
    noticeTicket({ channel_id: 4, ticket: { ticket_id: 7, state: 'progress' } });
    noticeTicket({ channel_id: 4 });
    stop();
    noticeTicket({ channel_id: 4, ticket: { ticket_id: 8 } });
    expect(seen).toEqual([7]);
  });
});
