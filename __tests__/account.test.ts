import type { Account } from '../src/auth/oauth';
import { localDayFromOdoo, meFrom, odooDateTime, plainSignature, selectionOf, setChannelNotifications, signatureHtml, discussSettings } from '../src/features/account/odoo';
import { appDevicesFrom, confirmIdentity, enableTotp, identityOf, makeApiKey, openTotp, revokeAllDevices, totpSecretGroups } from '../src/features/account/security';

const mockCalls: { model: string; method: string; args: unknown[]; kwargs: Record<string, unknown> }[] = [];
const mockAnswers: unknown[] = [];

jest.mock('../src/api/odoo', () => ({
  rpc: (_account: unknown, model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    mockCalls.push({ model, method, args, kwargs });
    return Promise.resolve(mockAnswers.shift());
  },
}));

const account = { id: 'a', origin: 'https://lab0.test', db: 'lab0', userId: 9, partnerId: 7, deviceId: 1, name: 'Budi', login: 'budi', signedInAt: 0 } as Account;
const identityAction = { type: 'ir.actions.act_window', res_model: 'res.users.identitycheck', res_id: 31 };

beforeEach(() => {
  mockCalls.length = 0;
  mockAnswers.length = 0;
});

describe('account preferences', () => {
  it('reads the user row with empty Odoo values as empty text', () => {
    expect(meFrom({ email: 'b@x.id', phone: false, tz: 'Asia/Jakarta', totp_enabled: true, out_of_office_from: false })).toMatchObject({
      email: 'b@x.id',
      phone: '',
      tz: 'Asia/Jakarta',
      totpEnabled: true,
      outOfOfficeFrom: '',
    });
  });

  it('reads selection choices from fields_get', () => {
    expect(selectionOf({ tz: { selection: [['Asia/Jakarta', 'Asia/Jakarta'], ['UTC', 'UTC']] } }, 'tz')).toEqual([
      { value: 'Asia/Jakarta', label: 'Asia/Jakarta' },
      { value: 'UTC', label: 'UTC' },
    ]);
    expect(selectionOf({}, 'tz')).toEqual([]);
  });

  it('stores Mentions only as no channel setting, the way the web does', async () => {
    mockAnswers.push([{ id: 4, channel_notifications: false }], {});
    expect(await discussSettings(account)).toEqual({ id: 4, channelNotifications: 'mentions' });
    await setChannelNotifications(account, 4, 'mentions');
    expect(mockCalls[1]).toMatchObject({ model: 'res.users.settings', method: 'set_res_users_settings', args: [[4]], kwargs: { new_settings: { channel_notifications: false } } });
  });

  it('keeps the lines of a signature and escapes typed markup', () => {
    expect(signatureHtml('Budi <b>\nKaitech & Co')).toBe('<div>Budi &lt;b&gt;<br>Kaitech &amp; Co</div>');
    expect(plainSignature(signatureHtml('Budi <b>\nKaitech & Co'))).toBe('Budi <b>\nKaitech & Co');
  });

  it('sends out-of-office bounds in UTC and shows them as local days', () => {
    const start = new Date(2026, 11, 1, 0, 0, 0);
    const stored = odooDateTime(start);
    expect(stored).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(localDayFromOdoo(stored)).toBe('2026-12-01');
  });
});

describe('empty and refused answers', () => {
  it('reads an empty user row as empty settings', () => {
    expect(meFrom({})).toEqual({ email: '', phone: '', tz: '', lang: '', signature: '', notificationType: '', outOfOfficeFrom: '', outOfOfficeTo: '', outOfOfficeMessage: '', calendarPrivacy: '', totpEnabled: false });
    expect(plainSignature('')).toBe('');
    expect(signatureHtml('   ')).toBe('');
    expect(localDayFromOdoo('')).toBe('');
  });

  it('creates the Discuss settings row on the first change when the user has none, like the web', async () => {
    mockAnswers.push([]);
    expect(await discussSettings(account)).toEqual({ id: null, channelNotifications: 'mentions' });
    mockAnswers.push(33, {});
    await setChannelNotifications(account, null, 'no_notif');
    expect(mockCalls[1]).toMatchObject({ model: 'res.users.settings', method: 'create', args: [{ user_id: 9 }] });
    expect(mockCalls[2]).toMatchObject({ method: 'set_res_users_settings', args: [[33]], kwargs: { new_settings: { channel_notifications: 'no_notif' } } });
  });

  it('fails loudly when the API key wizard answers without a key', async () => {
    mockAnswers.push(12, { res_model: 'res.users.apikeys.show', context: {} });
    await expect(makeApiKey(account, 'CI', '30')).rejects.toThrow('api_key_missing');
  });

  it('stops at the password check when the API key or TOTP window has passed', async () => {
    mockAnswers.push(12, identityAction);
    expect(await makeApiKey(account, 'CI', '30')).toEqual({ kind: 'identity', checkId: 31 });
    mockAnswers.push(identityAction);
    expect(await enableTotp(account, 8, '123 456')).toEqual({ kind: 'identity', checkId: 31 });
    expect(mockCalls[2]).toMatchObject({ model: 'auth_totp.wizard', method: 'enable', kwargs: { context: { code: '123456' } } });
  });

  it('reads the Kaitech app devices with the caller marked', () => {
    expect(appDevicesFrom({ devices: [{ id: 4, name: 'Mblu 21', platform: 'android', signed_in_at: '2026-11-20 01:00:00', last_used_at: false, current: true }, { name: 'x' }] })).toEqual([
      { id: 4, name: 'Mblu 21', platform: 'android', signedInAt: '2026-11-20 01:00:00', lastUsedAt: '', current: true },
    ]);
    expect(appDevicesFrom(null)).toEqual([]);
  });

  it('asks for the password again when run_check answers another identity check', () => {
    expect(identityOf({ res_model: 'res.users.identitycheck', res_id: 32 })).toBe(32);
    expect(identityOf({ res_model: 'auth_totp.wizard', res_id: 8 })).toBeNull();
  });
});

describe('identity check', () => {
  it('stops at the password check the web asks for, then resumes with the password in the context', async () => {
    mockAnswers.push(identityAction);
    expect(await openTotp(account)).toEqual({ kind: 'identity', checkId: 31 });
    mockAnswers.push({ res_model: 'auth_totp.wizard', res_id: 8 });
    await confirmIdentity(account, 31, 'secret');
    expect(mockCalls[1]).toMatchObject({ model: 'res.users.identitycheck', method: 'run_check', args: [[31]], kwargs: { context: { password: 'secret' } } });
  });

  it('runs straight through when the identity was checked a moment ago', async () => {
    mockAnswers.push({ type: 'ir.actions.client', tag: 'reload' });
    expect(await revokeAllDevices(account)).toEqual({ kind: 'done', value: true });
    expect(identityOf(false)).toBeNull();
  });

  it('hands back the new API key from the web wizard result', async () => {
    mockAnswers.push(12, { res_model: 'res.users.apikeys.show', context: { default_key: 'abc123' } });
    expect(await makeApiKey(account, ' CI ', '30')).toEqual({ kind: 'done', value: 'abc123' });
    expect(mockCalls[0]).toMatchObject({ model: 'res.users.apikeys.description', method: 'create', args: [{ name: 'CI', duration: '30' }] });
  });

  it('groups a TOTP key for reading aloud', () => {
    expect(totpSecretGroups('ABCD EFGH IJKL')).toBe('ABCD EFGH IJKL');
    expect(totpSecretGroups('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
  });
});
