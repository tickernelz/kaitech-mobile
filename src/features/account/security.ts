import type { Account } from '../../auth/oauth';
import { bearer, rpc } from '../../api/odoo';

export type Action = { type?: string; res_model?: string; res_id?: number; context?: Record<string, unknown> } | false | null;

export type Step<T> = { kind: 'identity'; checkId: number } | { kind: 'done'; value: T };

export function identityOf(result: unknown): number | null {
  const action = result as Action;
  return action && action.res_model === 'res.users.identitycheck' && typeof action.res_id === 'number' ? action.res_id : null;
}

async function guarded<T>(call: () => Promise<unknown>, then: (result: unknown) => Promise<T> | T): Promise<Step<T>> {
  const result = await call();
  const checkId = identityOf(result);
  if (checkId !== null) return { kind: 'identity', checkId };
  return { kind: 'done', value: await then(result) };
}

export function confirmIdentity(account: Account, checkId: number, password: string) {
  return rpc<unknown>(account, 'res.users.identitycheck', 'run_check', [[checkId]], { context: { password } });
}

export function openPasswordChange(account: Account) {
  return guarded(
    () => rpc<unknown>(account, 'res.users', 'preference_change_password', [[account.userId]]),
    () => true,
  );
}

export async function changePassword(account: Account, password: string, confirmation: string) {
  const wizard = await rpc<number>(account, 'change.password.own', 'create', [{ new_password: password, confirm_password: confirmation }]);
  return guarded(
    () => rpc<unknown>(account, 'change.password.own', 'change_password', [[wizard]]),
    () => true,
  );
}

export type TotpSetup = { wizardId: number; url: string; secret: string; qrcode: string };

export function openTotp(account: Account) {
  return guarded(
    () => rpc<unknown>(account, 'res.users', 'action_totp_enable_wizard', [[account.userId]]),
    (action) => totpSetup(account, action),
  );
}

export async function totpSetup(account: Account, action: unknown): Promise<TotpSetup> {
  const wizardId = (action as Action) && (action as { res_id?: unknown }).res_id;
  if (typeof wizardId !== 'number') throw new Error('totp_wizard_missing');
  const [row] = await rpc<Record<string, unknown>[]>(account, 'auth_totp.wizard', 'read', [[wizardId], ['url', 'secret', 'qrcode']]);
  return { wizardId, url: String(row?.url ?? ''), secret: String(row?.secret ?? ''), qrcode: String(row?.qrcode ?? '') };
}

export function enableTotp(account: Account, wizardId: number, code: string) {
  return guarded(
    () => rpc<unknown>(account, 'auth_totp.wizard', 'enable', [[wizardId]], { context: { code: code.replace(/\s+/g, '') } }),
    () => true,
  );
}

export function disableTotp(account: Account) {
  return guarded(
    () => rpc<unknown>(account, 'res.users', 'action_totp_disable', [[account.userId]]),
    () => true,
  );
}

export function totpSecretGroups(secret: string): string {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

export type ApiKey = { id: number; name: string; scope: string; created: string; expires: string };

export async function apiKeys(account: Account): Promise<ApiKey[]> {
  const rows = await rpc<Record<string, unknown>[]>(account, 'res.users.apikeys', 'search_read', [[['user_id', '=', account.userId]]], {
    fields: ['name', 'scope', 'create_date', 'expiration_date'],
    order: 'create_date desc',
  });
  return rows
    .filter((row) => typeof row.id === 'number')
    .map((row) => ({ id: row.id as number, name: String(row.name ?? ''), scope: typeof row.scope === 'string' ? row.scope : '', created: String(row.create_date || ''), expires: typeof row.expiration_date === 'string' ? row.expiration_date : '' }));
}

export type Duration = { value: string; label: string };

export async function apiKeyDurations(account: Account): Promise<Duration[]> {
  const fields = await rpc<Record<string, { selection?: unknown }>>(account, 'res.users.apikeys.description', 'fields_get', [['duration']], { attributes: ['selection'] });
  const selection = Array.isArray(fields.duration?.selection) ? (fields.duration.selection as unknown[]) : [];
  return selection
    .filter((pair): pair is [string, string] => Array.isArray(pair) && typeof pair[0] === 'string' && pair[0] !== '-1')
    .map(([value, label]) => ({ value, label }));
}

export function openApiKey(account: Account) {
  return guarded(
    () => rpc<unknown>(account, 'res.users', 'api_key_wizard', [[account.userId]]),
    () => true,
  );
}

export function apiKeyFrom(action: unknown): string {
  const key = (action as Action) && (action as { context?: Record<string, unknown> }).context?.default_key;
  if (typeof key !== 'string') throw new Error('api_key_missing');
  return key;
}

export async function makeApiKey(account: Account, name: string, duration: string): Promise<Step<string>> {
  const wizard = await rpc<number>(account, 'res.users.apikeys.description', 'create', [{ name: name.trim(), duration }]);
  return guarded(() => rpc<unknown>(account, 'res.users.apikeys.description', 'make_key', [[wizard]]), apiKeyFrom);
}

export function removeApiKey(account: Account, id: number) {
  return guarded(
    () => rpc<unknown>(account, 'res.users.apikeys', 'remove', [[id]]),
    () => true,
  );
}

export type Device = { id: number; platform: string; browser: string; type: string; ip: string; place: string; last: string; current: boolean };

export async function devices(account: Account): Promise<Device[]> {
  const rows = await rpc<Record<string, unknown>[]>(account, 'res.device', 'search_read', [[['user_id', '=', account.userId], ['revoked', '=', false]]], {
    fields: ['platform', 'browser', 'device_type', 'ip_address', 'city', 'country', 'last_activity', 'is_current'],
  });
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return rows
    .filter((row) => typeof row.id === 'number')
    .map((row) => ({
      id: row.id as number,
      platform: text(row.platform),
      browser: text(row.browser),
      type: text(row.device_type),
      ip: text(row.ip_address),
      place: [text(row.city), text(row.country)].filter(Boolean).join(', '),
      last: text(row.last_activity),
      current: row.is_current === true,
    }));
}

export function revokeDevice(account: Account, id: number) {
  return guarded(
    () => rpc<unknown>(account, 'res.device', 'revoke', [[id]]),
    () => true,
  );
}

export function revokeAllDevices(account: Account) {
  return guarded(
    () => rpc<unknown>(account, 'res.users', 'action_revoke_all_devices', [[account.userId]]),
    () => true,
  );
}

export type Passkey = { id: number; name: string; created: string };

export async function passkeys(account: Account): Promise<Passkey[]> {
  const rows = await rpc<Record<string, unknown>[]>(account, 'auth.passkey.key', 'search_read', [[['create_uid', '=', account.userId]]], { fields: ['name', 'create_date'] });
  return rows.filter((row) => typeof row.id === 'number').map((row) => ({ id: row.id as number, name: String(row.name ?? ''), created: String(row.create_date || '') }));
}

export function renamePasskey(account: Account, id: number, name: string) {
  return rpc<boolean>(account, 'auth.passkey.key', 'write', [[id], { name: name.trim() }]);
}

export function deletePasskey(account: Account, id: number) {
  return guarded(
    () => rpc<unknown>(account, 'auth.passkey.key', 'action_delete_passkey', [[id]]),
    () => true,
  );
}

export type AppDevice = { id: number; name: string; platform: string; signedInAt: string; lastUsedAt: string; current: boolean };

export function appDevicesFrom(body: unknown): AppDevice[] {
  const rows = (body as { devices?: unknown } | null)?.devices;
  if (!Array.isArray(rows)) return [];
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof (row as { id?: unknown }).id === 'number')
    .map((row) => ({
      id: row.id as number,
      name: text(row.name),
      platform: text(row.platform),
      signedInAt: text(row.signed_in_at),
      lastUsedAt: text(row.last_used_at),
      current: row.current === true,
    }));
}

export async function appDevices(account: Account): Promise<AppDevice[]> {
  return appDevicesFrom(await bearer<unknown>(account, '/kaitech_mobile/devices'));
}

export function revokeAppDevice(account: Account, id: number) {
  return bearer<unknown>(account, '/kaitech_mobile/devices/' + id + '/revoke', { method: 'POST', body: {} });
}
