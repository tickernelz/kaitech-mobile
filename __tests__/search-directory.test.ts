import type { Account } from '../src/auth/oauth';
import { directoryFrom, joinChannel, preview, searchDirectory } from '../src/features/search/people';

const mockCalls: { kind: string; target: string; args: unknown }[] = [];
const mockAnswers: unknown[] = [];

jest.mock('../src/api/odoo', () => ({
  route: (_account: unknown, path: string, params: unknown) => {
    mockCalls.push({ kind: 'route', target: path, args: params });
    return Promise.resolve(mockAnswers.shift());
  },
  rpc: (_account: unknown, model: string, method: string, args: unknown[], kwargs: unknown) => {
    mockCalls.push({ kind: 'rpc', target: `${model}.${method}`, args: [args, kwargs] });
    return Promise.resolve(mockAnswers.shift());
  },
}));

const account = { id: 'a', origin: 'https://lab0.test', db: 'lab0', userId: 9, partnerId: 7, deviceId: 1, name: 'Budi', login: 'budi', signedInAt: 0 } as Account;

beforeEach(() => {
  mockCalls.length = 0;
  mockAnswers.length = 0;
});

describe('people and channel search', () => {
  it('keeps channels and groups, drops direct chats and the signed-in person', () => {
    const hits = directoryFrom(
      {
        'discuss.channel': [
          { id: 1, name: 'general', channel_type: 'channel', self_member_id: 44 },
          { id: 2, name: 'Sales', channel_type: 'channel', self_member_id: false },
          { id: 3, name: 'Budi, Sari', channel_type: 'chat' },
          { id: 4, name: 'Project', channel_type: 'group', is_member: true },
        ],
        'res.partner': [
          { id: 7, name: 'Budi' },
          { id: 8, name: 'Sari', email: 'sari@x.id' },
        ],
      },
      7,
    );
    expect(hits.channels).toEqual([
      { id: 1, name: 'general', type: 'channel', member: true },
      { id: 2, name: 'Sales', type: 'channel', member: false },
      { id: 4, name: 'Project', type: 'group', member: true },
    ]);
    expect(hits.people).toEqual([{ partnerId: 8, name: 'Sari', email: 'sari@x.id' }]);
  });

  it('asks the web search route with the typed words', async () => {
    mockAnswers.push({});
    await searchDirectory(account, 'sar');
    expect(mockCalls[0]).toEqual({ kind: 'route', target: '/discuss/search', args: { term: 'sar', limit: 20 } });
  });

  it('joins a public channel as the signed-in person', async () => {
    mockAnswers.push([]);
    await joinChannel(account, 2);
    expect(mockCalls[0]).toEqual({ kind: 'rpc', target: 'discuss.channel.add_members', args: [[[2]], { partner_ids: [7] }] });
  });

  it('shows five per kind in All and the rest behind See all', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    expect(preview(items, false)).toEqual({ shown: [1, 2, 3, 4, 5], more: 2 });
    expect(preview(items, true)).toEqual({ shown: items, more: 0 });
    expect(preview([1, 2], false)).toEqual({ shown: [1, 2], more: 0 });
  });
});
