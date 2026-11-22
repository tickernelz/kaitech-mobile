import { useCallback, useSyncExternalStore } from 'react';
import { accountKnown, onAccountForgotten } from '../../auth/session';
import { statusesInStore } from './status';

const books = new Map<string, Map<number, string | null>>();
const listeners = new Set<() => void>();

export function noteStatusList(accountId: string, list: Iterable<readonly [number, string | null]>) {
  if (!accountKnown(accountId)) return;
  let book = books.get(accountId);
  if (!book) {
    book = new Map();
    books.set(accountId, book);
  }
  let changed = false;
  for (const [partnerId, status] of list) {
    if (book.has(partnerId) && book.get(partnerId) === status) continue;
    book.set(partnerId, status);
    changed = true;
  }
  if (changed) listeners.forEach((listener) => listener());
}

export function noteStatuses(accountId: string | null, store: unknown) {
  if (!accountId) return;
  const found = statusesInStore(store);
  if (found.length) noteStatusList(accountId, found);
}

export function partnerStatus(accountId: string, partnerId: number): string | null {
  return books.get(accountId)?.get(partnerId) ?? null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePartnerStatus(accountId: string | null, partnerId: number | null | undefined): string | null {
  const read = useCallback(() => (accountId && partnerId ? partnerStatus(accountId, partnerId) : null), [accountId, partnerId]);
  return useSyncExternalStore(subscribe, read);
}

onAccountForgotten((accountId) => {
  if (books.delete(accountId)) listeners.forEach((listener) => listener());
});
