import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

const key = 'chat.tapToRecord';
let on = Storage.getItemSync(key) === '1';
const listeners = new Set<() => void>();

export function tapToRecord(): boolean {
  return on;
}

export function setTapToRecord(next: boolean) {
  if (next === on) return;
  on = next;
  Storage.setItemSync(key, next ? '1' : '0');
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTapToRecord(): boolean {
  return useSyncExternalStore(subscribe, tapToRecord, tapToRecord);
}
