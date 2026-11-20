import type { Account } from '../../auth/oauth';
import { getSession } from '../../auth/session';

export function accountForPush(data: { db?: string; uid?: number }, accounts: Pick<Account, 'id' | 'db' | 'userId'>[]): Account | null {
  const db = typeof data.db === 'string' ? data.db : '';
  const uid = Number(data.uid);
  if (!db || !Number.isInteger(uid) || uid <= 0) return null;
  const found = accounts.filter((account) => account.db === db && account.userId === uid);
  return found.length === 1 ? (found[0] as Account) : null;
}

export function accountFromPush(data: { db?: string; uid?: number }): Account | null {
  return accountForPush(data, getSession().accounts);
}
