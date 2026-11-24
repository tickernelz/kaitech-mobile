import { rpc } from '../src/api/odoo';
import { agentCardsFor } from '../src/features/chat/coworker';

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/api/odoo', () => ({ route: jest.fn(), rpc: jest.fn(), bearer: jest.fn(), sessionCookie: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => ({ account: { origin: 'https://lab0.kaitech.io' } }), getChat: () => ({ partnerId: 3 }), patchMessages: jest.fn(), refreshConversations: jest.fn() }));

describe('Coworker answer cards', () => {
  it('keeps the block answer the web shows in place of the plain reply', async () => {
    const said = 'Ringkasan\n```kt\n{"kind":"kpi","items":[]}\n```';
    jest.mocked(rpc).mockResolvedValue({ '41': { packets: [], wardmote: false, said }, '42': { packets: [], said: '' } });
    const result = await agentCardsFor(9, [41, 42, 43]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.get(41)?.said).toBe(said);
    expect(result.value.get(42)?.said).toBe('');
    expect(result.value.get(43)).toEqual({ packets: [], wardmote: null, handedBy: null, said: '' });
  });

  it('reads a missing or non-text said as no block answer', async () => {
    jest.mocked(rpc).mockResolvedValue({ '7': { packets: [], said: false } });
    const result = await agentCardsFor(9, [7]);
    expect(result.ok && result.value.get(7)?.said).toBe('');
  });
});
