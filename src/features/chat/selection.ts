import { useSyncExternalStore } from 'react';

let selected: number | null = null;
let focus: number | null = null;
const listeners = new Set<() => void>();

export function selectChannel(id: number | null, message: number | null = null) {
  if (selected === id && focus === message) return;
  selected = id;
  focus = message;
  listeners.forEach((listener) => listener());
}

export function selectedChannel(): number | null {
  return selected;
}

export function useSelectedChannel(): number | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selected,
  );
}

export function focusedMessage(): number | null {
  return focus;
}
