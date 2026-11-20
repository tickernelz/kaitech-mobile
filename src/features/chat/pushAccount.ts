import type { Account } from '../../auth/oauth';

export type KeyValue = { get(key: string): string | null; set(key: string, value: string): void };

export const registeredKey = 'chat.pushRegistered';

export function registrationMarker(account: Pick<Account, 'id' | 'deviceId'>, token: string, language: string): string {
  return `${account.id}|${account.deviceId}|${token}|${language}`;
}

export async function syncPushToken(input: {
  store: KeyValue;
  account: Pick<Account, 'id' | 'deviceId'>;
  token: string;
  language: 'en' | 'id';
  registerPush: (token: string, language: 'en' | 'id') => Promise<unknown>;
}): Promise<boolean> {
  const marker = registrationMarker(input.account, input.token, input.language);
  if (input.store.get(registeredKey) === marker) return false;
  await input.registerPush(input.token, input.language);
  input.store.set(registeredKey, marker);
  return true;
}

export type PushTarget = { accountId: string; switchTo: boolean } | null;

export function accountForPush(data: Record<string, unknown>, accounts: Pick<Account, 'id' | 'db' | 'userId'>[], activeId: string | null): PushTarget {
  const db = typeof data.db === 'string' ? data.db : null;
  const uid = Number(data.uid);
  if (db && Number.isInteger(uid) && uid > 0) {
    const match = accounts.find((account) => account.db === db && account.userId === uid);
    return match ? { accountId: match.id, switchTo: match.id !== activeId } : null;
  }
  if (accounts.length === 1 && activeId === accounts[0].id) return { accountId: activeId, switchTo: false };
  return null;
}
