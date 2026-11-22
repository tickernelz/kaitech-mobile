import type { Account } from '../src/auth/oauth';
import { canCreatePasskey, createCredential, creationOptions, PasskeyError, savePasskey, startPasskey } from '../src/features/account/passkey';

const mockCalls: { model: string; method: string; args: unknown[] }[] = [];
const mockAnswers: unknown[] = [];
const mockNative: { module: { create: jest.Mock } | null } = { module: null };

jest.mock('../src/api/odoo', () => ({
  rpc: (_account: unknown, model: string, method: string, args: unknown[] = []) => {
    mockCalls.push({ model, method, args });
    return Promise.resolve(mockAnswers.shift());
  },
}));

jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative.module }));

const account = { id: 'a', origin: 'https://lab0.test', db: 'lab0', userId: 9, partnerId: 7, deviceId: 1, name: 'Budi', login: 'budi', signedInAt: 0 } as Account;
const registration = { challenge: 'Y2g', rp: { id: 'lab0.test', name: 'lab0' }, user: { id: 'OQ', name: 'budi', displayName: 'Budi' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }] };
const created = { id: 'cred', rawId: 'cred', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'o2M' } };

beforeEach(() => {
  mockCalls.length = 0;
  mockAnswers.length = 0;
  mockNative.module = null;
});

describe('adding a passkey from the phone', () => {
  it('asks for the identity check first when the server answers with one', async () => {
    mockAnswers.push({ type: 'ir.actions.act_window', res_model: 'res.users.identitycheck', res_id: 31 });
    expect(await startPasskey(account)).toEqual({ kind: 'identity', checkId: 31 });
    expect(mockCalls[0]).toEqual({ model: 'res.users', method: 'action_create_passkey', args: [[9]] });
  });

  it('hands the server creation options to the passkey manager as JSON and saves the answer under the typed name', async () => {
    mockNative.module = { create: jest.fn().mockResolvedValue(JSON.stringify(created)) };
    mockAnswers.push({ type: 'ir.actions.act_window', res_model: 'auth.passkey.key.create', context: { registration } });
    const step = await startPasskey(account);
    expect(step).toEqual({ kind: 'done', value: registration });
    const credential = await createCredential(registration);
    expect(JSON.parse(mockNative.module.create.mock.calls[0][0])).toEqual(registration);
    mockAnswers.push(44, true);
    expect(await savePasskey(account, '  Mblu 21 ', credential)).toBe(true);
    expect(mockCalls.slice(1)).toEqual([
      { model: 'auth.passkey.key.create', method: 'create', args: [{ name: 'Mblu 21' }] },
      { model: 'auth.passkey.key.create', method: 'make_key', args: [[44], created] },
    ]);
  });

  it('refuses an answer that carries no creation options', () => {
    expect(() => creationOptions({ type: 'ir.actions.client', tag: 'reload' })).toThrow(PasskeyError);
    expect(() => creationOptions(false)).toThrow(PasskeyError);
  });

  it('tells a cancelled prompt and a phone without a passkey manager apart from a failure', async () => {
    mockNative.module = { create: jest.fn() };
    const reasons: string[] = [];
    for (const code of ['ERR_PASSKEY_CANCELLED', 'ERR_PASSKEY_NO_PROVIDER', 'ERR_PASSKEY_FAILED', undefined]) {
      mockNative.module.create.mockRejectedValueOnce(Object.assign(new Error('x'), { code }));
      await createCredential(registration).catch((error: PasskeyError) => reasons.push(error.reason));
    }
    expect(reasons).toEqual(['cancelled', 'noProvider', 'failed', 'failed']);
  });

  it('offers adding only where the native passkey module exists', () => {
    expect(canCreatePasskey()).toBe(false);
    mockNative.module = { create: jest.fn() };
    expect(canCreatePasskey()).toBe(true);
  });

  it('reports a missing passkey manager when the module is absent', async () => {
    await expect(createCredential(registration)).rejects.toMatchObject({ reason: 'noProvider' });
  });
});
