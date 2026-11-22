import type { Account } from '../src/auth/oauth';
import { cardFrom, chatWith, personCard, presenceOf } from '../src/features/people/card';

const mockCalls: { kind: string; target: string; params: unknown }[] = [];
const mockAnswers: unknown[] = [];

jest.mock('../src/api/odoo', () => ({
  route: (_account: unknown, path: string, params: unknown) => {
    mockCalls.push({ kind: 'route', target: path, params });
    return Promise.resolve(mockAnswers.shift());
  },
  rpc: (_account: unknown, model: string, method: string, args: unknown[]) => {
    mockCalls.push({ kind: 'rpc', target: `${model}.${method}`, params: args });
    return Promise.resolve(mockAnswers.shift());
  },
}));

const account = { id: 'a', origin: 'https://lab0.test', db: 'lab0', userId: 9, partnerId: 7, deviceId: 1, name: 'Budi', login: 'budi', signedInAt: 0 } as Account;

beforeEach(() => {
  mockCalls.length = 0;
  mockAnswers.length = 0;
});

describe('person card', () => {
  it('reads the web avatar card of one partner and its presence', () => {
    const store = { 'res.partner': [{ id: 3, name: 'Sari', email: 'sari@x.id', phone: '0812', im_status: 'online', partner_share: false }, { id: 4, name: 'Other' }] };
    expect(cardFrom(store, 3)).toEqual({ partnerId: 3, name: 'Sari', email: 'sari@x.id', phone: '0812', presence: 'online', external: false });
    expect(cardFrom(store, 99)).toBeNull();
  });

  it('keeps contact details empty when the server withholds them from a portal viewer', () => {
    expect(cardFrom({ 'res.partner': [{ id: 3, name: 'Sari', im_status: 'im_partner', partner_share: true }] }, 3)).toMatchObject({ email: '', phone: '', presence: 'offline', external: true });
  });

  it('maps Odoo presence values, including the busy and away variants', () => {
    expect(['online', 'away', 'busy_online', 'offline', 'im_partner', undefined].map(presenceOf)).toEqual(['online', 'away', 'busy', 'offline', 'offline', 'offline']);
  });

  it('adds the status line from the user behind the partner', async () => {
    mockAnswers.push({ 'res.partner': [{ id: 3, name: 'Sari', im_status: 'away' }] }, [{ id: 3, function: 'Finance', parent_name: 'PT A', user_ids: [11] }], [{ id: 11, kaitech_status_text: 'Rapat' }]);
    expect(await personCard(account, 3)).toMatchObject({ name: 'Sari', presence: 'away', status: 'Rapat', title: 'Finance', company: 'PT A' });
    expect(mockCalls[0]).toMatchObject({ target: '/mail/data', params: { fetch_params: [['avatar_card', { id: 3, model: 'res.partner' }]] } });
  });

  it('shows nothing when the server withholds the partner from this viewer', async () => {
    mockAnswers.push({}, [], []);
    expect(await personCard(account, 3)).toBeNull();
  });

  it('keeps the card without a status when the partner has no user', async () => {
    mockAnswers.push({ 'res.partner': { id: 3, name: 'Vendor' } }, [{ id: 3, function: false, parent_name: false, user_ids: [] }]);
    expect(await personCard(account, 3)).toMatchObject({ name: 'Vendor', status: '', title: '', company: '' });
  });

  it('opens the direct chat through the web action and returns its channel', async () => {
    mockAnswers.push({ DataResponse: [{ id: 1, _resolve: true, channel: 55 }] });
    expect(await chatWith(account, 3)).toBe(55);
    expect(mockCalls[0]).toMatchObject({ target: '/mail/action', params: { fetch_params: [['/discuss/get_or_create_chat', { partners_to: [3] }, 1]] } });
    mockAnswers.push({ DataResponse: { id: 1, channel: { id: 56 } } });
    expect(await chatWith(account, 3)).toBe(56);
    mockAnswers.push({});
    await expect(chatWith(account, 3)).rejects.toThrow('chat_missing');
  });
});
