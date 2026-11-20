import { useEffect, useSyncExternalStore } from 'react';
import { chatClient, useChat } from '../chat';

let cookie: Record<string, string> | null = null;
let owner: string | null = null;
let loading = false;
const listeners = new Set<() => void>();

function load(accountId: string) {
  const client = chatClient();
  if (!client || loading) return;
  loading = true;
  void client
    .cookieHeaders()
    .then((headers) => {
      cookie = headers;
      owner = accountId;
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined)
    .finally(() => {
      loading = false;
    });
}

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
