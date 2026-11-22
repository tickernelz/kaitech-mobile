import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

export type UndoState = { id: number; label: string; failed: boolean } | null;

type Pending = { id: number; revert: () => void; commit: () => Promise<boolean>; timer: ReturnType<typeof setTimeout> };

export const undoWindowMs = 5000;
const failureShownMs = 4000;

let shown: UndoState = null;
let pending: Pending | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
let windowMs: number = undoWindowMs;
let windowAsked = false;

export function primeUndoWindow() {
  if (windowAsked) return;
  windowAsked = true;
  void AccessibilityInfo?.getRecommendedTimeoutMillis?.(undoWindowMs)
    .then((recommended) => {
      windowMs = Math.max(undoWindowMs, recommended);
    })
    .catch(() => undefined);
}
const listeners = new Set<() => void>();

function show(next: UndoState) {
  shown = next;
  listeners.forEach((listener) => listener());
}

async function settle(item: Pending) {
  if (pending === item) pending = null;
  let ok = false;
  try {
    ok = await item.commit();
  } catch {
    ok = false;
  }
  if (ok) {
    if (shown?.id === item.id) show(null);
    return;
  }
  item.revert();
  showFailure('', item.id);
}

export function showFailure(label: string, id = nextId++) {
  if (hideTimer) clearTimeout(hideTimer);
  show({ id, label, failed: true });
  hideTimer = setTimeout(() => {
    if (shown?.id === id) show(null);
  }, failureShownMs);
}

export function deferUndoable({ label, apply, revert, commit }: { label: string; apply: () => void; revert: () => void; commit: () => Promise<boolean> }): number {
  if (pending) {
    const previous = pending;
    clearTimeout(previous.timer);
    void settle(previous);
  }
  if (hideTimer) clearTimeout(hideTimer);
  primeUndoWindow();
  const id = nextId++;
  apply();
  const item: Pending = { id, revert, commit, timer: setTimeout(() => void settle(item), windowMs) };
  pending = item;
  show({ id, label, failed: false });
  return id;
}

export function undoLast() {
  const item = pending;
  if (!item) return;
  clearTimeout(item.timer);
  pending = null;
  item.revert();
  show(null);
}

export function flushUndo() {
  const item = pending;
  if (!item) return;
  clearTimeout(item.timer);
  void settle(item);
}

export function useUndo(): UndoState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => shown,
  );
}
