import { useEffect, useSyncExternalStore } from 'react';
import { onSessionOpened } from '../../../api/odoo';
import { onAccountForgotten } from '../../../auth/session';
import { chatClient, useChat } from '../chat';

let cookie: Record<string, string> | null = null;
let owner: string | null = null;
let loading: string | null = null;
const listeners = new Set<() => void>();

function publish(next: Record<string, string> | null, accountId: string | null) {
  cookie = next;
  owner = accountId;
  listeners.forEach((listener) => listener());
}

function load(accountId: string) {
  const client = chatClient();
  if (!client || client.account.id !== accountId || loading === accountId) return;
  loading = accountId;
  void client
    .cookieHeaders()
    .then((headers) => {
      if (chatClient()?.account.id === accountId) publish(headers, accountId);
    })
    .catch(() => undefined)
    .finally(() => {
      if (loading === accountId) loading = null;
    });
}

onSessionOpened((accountId) => {
  if (owner === accountId) load(accountId);
});

onAccountForgotten((accountId) => {
  if (owner === accountId) publish(null, null);
});

export function useCookie(): Record<string, string> | null {
  const accountId = useChat((state) => state.accountId);
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (owner === accountId ? cookie : null),
  );
  useEffect(() => {
    if (accountId && owner !== accountId) load(accountId);
  }, [accountId]);
  return value;
}
