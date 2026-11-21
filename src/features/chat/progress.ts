import { useSyncExternalStore } from 'react';

const sent = new Map<string, number>();
const listeners = new Set<() => void>();

export function setUploadProgress(key: string, fraction: number | null) {
  if (fraction === null) {
    if (!sent.delete(key)) return;
  } else {
    const next = Math.min(1, Math.max(0, fraction));
    if (sent.get(key) === next) return;
    sent.set(key, next);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUploadProgress(key: string): number | null {
  return useSyncExternalStore(subscribe, () => sent.get(key) ?? null);
}
