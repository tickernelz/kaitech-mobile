import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Account } from '../auth/oauth';
import { onAccountForgotten, useSession } from '../auth/session';

type Entry = { data?: unknown; error?: unknown; at: number; loading: boolean };

const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const idle: Entry = { at: 0, loading: false };
const generations = new Map<string, number>();

function generationOf(key: string): number {
  return generations.get(key.slice(0, key.indexOf(':'))) ?? 0;
}

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function put(key: string, next: Partial<Entry>) {
  entries.set(key, { ...(entries.get(key) ?? idle), ...next });
  notify(key);
}

export async function load<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  if (entries.get(key)?.loading) return;
  const generation = generationOf(key);
  put(key, { loading: true });
  let next: Partial<Entry>;
  try {
    next = { data: await fetcher(), error: undefined, at: Date.now(), loading: false };
  } catch (error) {
    next = { error, loading: false };
  }
  if (generationOf(key) === generation) put(key, next);
}

export function update<T>(key: string, change: (current: T | undefined) => T) {
  put(key, { data: change(entries.get(key)?.data as T | undefined) });
}

export function invalidate(prefix: string) {
  for (const [key, entry] of entries) {
    if (key.startsWith(prefix)) {
      entries.set(key, { ...entry, at: 0 });
      notify(key);
    }
  }
}

onAccountForgotten((accountId) => {
  generations.set(accountId, (generations.get(accountId) ?? 0) + 1);
  for (const key of [...entries.keys()]) if (key.startsWith(`${accountId}:`)) entries.delete(key);
});

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

export type Resource<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refresh: () => Promise<void>;
  key: string | null;
};

export function useResource<T>(
  path: string | null,
  fetcher: (account: Account) => Promise<T>,
  staleMs = 30_000,
): Resource<T> {
  const { active } = useSession();
  const key = active && path ? `${active.id}:${path}` : null;
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  const entry = useSyncExternalStore(
    useCallback((listener: () => void) => (key ? subscribe(key, listener) : () => undefined), [key]),
    () => (key ? (entries.get(key) ?? idle) : idle),
  );
  const refresh = useCallback(async () => {
    if (key && active) await load(key, () => fetcherRef.current(active));
  }, [key, active]);
  const refreshIfStale = useCallback(() => {
    if (key && Date.now() - (entries.get(key)?.at ?? 0) > staleMs) void refresh();
  }, [key, staleMs, refresh]);
  useEffect(refreshIfStale, [refreshIfStale, entry.at]);
  useFocusEffect(refreshIfStale);
  return { data: entry.data as T | undefined, error: entry.error, loading: entry.loading, refresh, key };
}
