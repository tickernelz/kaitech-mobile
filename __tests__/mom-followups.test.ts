import type { Account } from '../src/auth/oauth';
import { canWork, dayFrom, isDay, raiseFollowup, saveDetails, type FollowupRow } from '../src/features/mom/followups';

const mockRpc = jest.fn();
jest.mock('../src/api/odoo', () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }));

const account = { id: 'u2_test' } as Account;

const row: FollowupRow = {
  id: 9,
  code: 'A-9',
  name: 'Send the price list',
  topic: '',
  detail: '',
  urgency: '',
  urgencyLabel: '',
  owner: { id: 4, name: 'Ani' },
  ownerSaid: '',
  deadline: '2026-12-01',
  dueIn: 9,
  status: 'open',
  statusLabel: 'Open',
  progress: 0,
  meeting: { id: 2, name: 'Kickoff' },
  archived: false,
  reported: true,
  draftedBy: '',
};

beforeEach(() => {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ action_id: 31 });
});

describe('saving follow-up details', () => {
  it('leaves owner and due date alone when only the detail changed, so a reported item still saves', async () => {
    await saveDetails(account, row, { owner: 4, deadline: '2026-12-01', urgency: 'high', topic: 'Pricing', detail: 'Both regions' });
    expect(mockRpc.mock.calls.map((call) => call[2])).toEqual(['set_followup_details']);
    expect(mockRpc.mock.calls[0][3]).toEqual([9]);
    expect(mockRpc.mock.calls[0][4]).toEqual({ urgency: 'high', topic: 'Pricing', detail: 'Both regions' });
  });

  it('revises only what changed before writing the rest', async () => {
    await saveDetails(account, row, { owner: 5, deadline: '2026-12-01', urgency: '', topic: '', detail: '' });
    expect(mockRpc.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      ['ck.meeting.action', 'revise'],
      ['ck.meeting.action.update', 'set_followup_details'],
    ]);
    expect(mockRpc.mock.calls[0][4]).toEqual({ owner_profile_id: 5 });
  });

  it('raises a follow-up on its meeting and writes urgency and detail only when given', async () => {
    await expect(raiseFollowup(account, { meeting: 2, name: '  Call back ', owner: 4, deadline: '2026-12-02', urgency: '', detail: ' ' })).resolves.toBe(31);
    expect(mockRpc.mock.calls).toEqual([[account, 'ck.meeting', 'raise_action', [[2], 'Call back', 4, '2026-12-02']]]);
  });
});

describe('follow-up rules', () => {
  it('works on proposed, open and late items that are not archived', () => {
    expect(['draft', 'open', 'late', 'done', 'dropped'].map((status) => canWork({ status, archived: false }))).toEqual([true, true, true, false, false]);
    expect(canWork({ status: 'open', archived: true })).toBe(false);
  });

  it('accepts only real calendar days', () => {
    expect(['2026-02-28', '2028-02-29', '2026-02-29', '2026-13-01', '26-1-1', ''].map(isDay)).toEqual([true, true, false, false, false, false]);
    expect(dayFrom(1, new Date(2026, 11, 31))).toBe('2027-01-01');
  });
});
