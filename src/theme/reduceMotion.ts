import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let reduced = false;
let watching = false;
const listeners = new Set<() => void>();

function publish(next: boolean) {
  if (next === reduced) return;
  reduced = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching) {
    watching = true;
    AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
    void AccessibilityInfo.isReduceMotionEnabled().then(publish, () => undefined);
  }
  return () => listeners.delete(listener);
}

export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduced);
}
