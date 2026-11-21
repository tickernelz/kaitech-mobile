import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

const key = 'call.pictureInPicture';
let allowed = Storage.getItemSync(key) !== '0';
const listeners = new Set<() => void>();

export function pictureInPictureAllowed(): boolean {
  return allowed;
}

export function setPictureInPictureAllowed(next: boolean) {
  if (next === allowed) return;
  allowed = next;
  Storage.setItemSync(key, next ? '1' : '0');
  listeners.forEach((listener) => listener());
}

export function onPictureInPictureAllowedChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePictureInPictureAllowed(): boolean {
  return useSyncExternalStore(onPictureInPictureAllowedChange, pictureInPictureAllowed, pictureInPictureAllowed);
}
