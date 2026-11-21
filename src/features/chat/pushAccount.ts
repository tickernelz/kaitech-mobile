import type { Account } from '../../auth/oauth';

export const pushFormat = 2;

export type KeyValue = { get(key: string): string | null; set(key: string, value: string): void };

export const registeredKey = 'chat.pushRegistered';

export function registrationMarker(account: Pick<Account, 'id' | 'deviceId'>, token: string, language: string): string {
  return `${account.id}|${account.deviceId}|${token}|${language}|${pushFormat}`;
}

export function previewKey(account: Pick<Account, 'id' | 'deviceId'>): string {
  return `chat.pushPreview.${account.id}.${account.deviceId}`;
}

export async function syncPushToken(input: {
  store: KeyValue;
  account: Pick<Account, 'id' | 'deviceId'>;
  token: string;
  language: 'en' | 'id';
  preview: boolean;
  registerPush: (token: string, language: 'en' | 'id', preview: boolean) => Promise<unknown>;
}): Promise<boolean> {
  const marker = registrationMarker(input.account, input.token, input.language);
  if (input.store.get(registeredKey) === marker && input.store.get(previewKey(input.account)) === String(input.preview)) return false;
  await input.registerPush(input.token, input.language, input.preview);
  input.store.set(registeredKey, marker);
  input.store.set(previewKey(input.account), String(input.preview));
  return true;
}

export async function syncPreview<A extends Pick<Account, 'id' | 'deviceId'>>(input: {
  store: KeyValue;
  accounts: A[];
  preview: boolean;
  setPreview: (account: A, preview: boolean) => Promise<unknown>;
}): Promise<void> {
  for (const account of input.accounts) {
    const key = previewKey(account);
    if (input.store.get(key) === String(input.preview)) continue;
    try {
      await input.setPreview(account, input.preview);
      input.store.set(key, String(input.preview));
    } catch {
      continue;
    }
  }
}

export type PushTarget = { accountId: string; switchTo: boolean } | null;

export function accountForPush(data: Record<string, unknown>, accounts: Pick<Account, 'id' | 'db' | 'userId'>[], activeId: string | null): PushTarget {
  const db = typeof data.db === 'string' ? data.db : null;
  const uid = Number(data.uid);
  if (db && Number.isInteger(uid) && uid > 0) {
    const matches = accounts.filter((account) => account.db === db && account.userId === uid);
    if (matches.length !== 1) return null;
    return { accountId: matches[0].id, switchTo: matches[0].id !== activeId };
  }
  if (accounts.length === 1 && activeId === accounts[0].id) return { accountId: activeId, switchTo: false };
  return null;
}
