import type { Account } from '../src/auth/oauth';
import { inviteesFrom, inviteToCall, searchInvitees } from '../src/features/call/invite';
import { loadVolumes, saveVolume } from '../src/features/call/volumes';

const mockCalls: { model: string; method: string; args: unknown[]; kwargs: Record<string, unknown> }[] = [];
const mockAnswers: unknown[] = [];

jest.mock('../src/api/odoo', () => ({
  rpc: (_account: unknown, model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    mockCalls.push({ model, method, args, kwargs });
    return Promise.resolve(mockAnswers.shift());
  },
}));

const account = { id: 'a', origin: 'https://lab0.test', db: 'lab0', userId: 9, partnerId: 7, deviceId: 1, name: 'Budi', login: 'budi', signedInAt: 0 } as Account;

beforeEach(() => {
  mockCalls.length = 0;
  mockAnswers.length = 0;
});

describe('inviting to a call', () => {
  it('lists the people the web invitation panel would offer, in its order', async () => {
    mockAnswers.push({ partner_ids: [5, 3], store_data: { 'res.partner': [{ id: 3, name: 'Sari' }, { id: 5, name: 'Andi' }] } });
    expect(await searchInvitees(account, 'a', 12)).toEqual([
      { partnerId: 5, name: 'Andi' },
      { partnerId: 3, name: 'Sari' },
    ]);
    expect(mockCalls[0]).toMatchObject({ model: 'res.partner', method: 'search_for_channel_invite', args: ['a', 12] });
    expect(inviteesFrom(null)).toEqual([]);
  });

  it('adds the picked people and rings them, like inviting from the web call', async () => {
    mockAnswers.push([]);
    await inviteToCall(account, 12, [5, 3]);
    expect(mockCalls[0]).toMatchObject({ model: 'discuss.channel', method: 'add_members', args: [[12]], kwargs: { partner_ids: [5, 3], invite_to_rtc_call: true } });
  });
});

describe('participant volume', () => {
  it('reads the volumes saved per person, the ones the web uses too', async () => {
    mockAnswers.push([
      { id: 1, partner_id: [3, 'Sari'], volume: 0.3 },
      { id: 2, partner_id: false, volume: 0.9 },
    ]);
    expect([...(await loadVolumes(account)).entries()]).toEqual([[3, 0.3]]);
    expect(mockCalls[0].args).toEqual([[['user_setting_id.user_id', '=', 9], ['partner_id', '!=', false]]]);
  });

  it('keeps every volume at full when nothing was saved', async () => {
    mockAnswers.push([]);
    expect((await loadVolumes(account)).size).toBe(0);
  });

  it('creates the settings record first when the user has none, like the web', async () => {
    mockAnswers.push([], 21, true);
    await saveVolume(account, 3, 0.4);
    expect(mockCalls.map((call) => `${call.model}.${call.method}`)).toEqual(['res.users.settings.search_read', 'res.users.settings.create', 'res.users.settings.set_volume_setting']);
    expect(mockCalls[1].args).toEqual([{ user_id: 9 }]);
    expect(mockCalls[2].args).toEqual([[21], 3, 0.4]);
  });

  it('saves a volume on the user settings record', async () => {
    mockAnswers.push([{ id: 4 }], true);
    await saveVolume(account, 3, 0.25);
    expect(mockCalls[1]).toMatchObject({ model: 'res.users.settings', method: 'set_volume_setting', args: [[4], 3, 0.25] });
  });
});
