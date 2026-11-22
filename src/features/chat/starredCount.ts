import { useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();

export function setStarredCount(next: number) {
  const value = Math.max(0, next);
  if (value === count) return;
  count = value;
  listeners.forEach((listener) => listener());
}

export function starredCount(): number {
  return count;
}

export function noteStarToggled(starred: boolean) {
  setStarredCount(count + (starred ? 1 : -1));
}

export function useStarredCount(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => count,
  );
}
