import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

let shown = new Set<number>();
let active = AppState.currentState === 'active';
let quiet = false;
const byMessage = new Map<number, Set<() => void>>();
const everyone = new Set<() => void>();

AppState.addEventListener('change', (next) => {
  const now = next === 'active';
  if (now === active) return;
  active = now;
  everyone.forEach((listener) => listener());
});

export function setMediaQuiet(next: boolean) {
  if (next === quiet) return;
  quiet = next;
  everyone.forEach((listener) => listener());
}

export function setShownMessages(ids: number[]) {
  const next = new Set(ids);
  const changed = [...shown].filter((id) => !next.has(id)).concat(ids.filter((id) => !shown.has(id)));
  shown = next;
  for (const id of changed) byMessage.get(id)?.forEach((listener) => listener());
}

function subscribe(id: number | null, listener: () => void): () => void {
  everyone.add(listener);
  if (id === null) return () => everyone.delete(listener);
  const set = byMessage.get(id) ?? new Set();
  set.add(listener);
  byMessage.set(id, set);
  return () => {
    everyone.delete(listener);
    set.delete(listener);
    if (!set.size) byMessage.delete(id);
  };
}

export function useOnScreen(id: number | null): boolean {
  return useSyncExternalStore(
    (listener) => subscribe(id, listener),
    () => active && !quiet && (id === null || shown.has(id)),
  );
}
