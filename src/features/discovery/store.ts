import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { onAccountForgotten } from '../../auth/session';

const listeners = new Set<() => void>();
const drafts = new Map<string, string>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function draftKey(account: string, programme: number, conversation: number | null) {
  return `discovery.draft.${account}.${programme}.${conversation ?? 'new'}`;
}

export function readDraft(account: string, programme: number, conversation: number | null): string {
  const key = draftKey(account, programme, conversation);
  if (!drafts.has(key)) drafts.set(key, Storage.getItemSync(key) ?? '');
  return drafts.get(key) ?? '';
}

const saveDelayMs = 400;
const unsaved = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function flushDrafts() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  for (const key of unsaved) {
    const text = drafts.get(key) ?? '';
    if (text) Storage.setItemSync(key, text);
    else Storage.removeItemSync(key);
  }
  unsaved.clear();
}

export function writeDraft(account: string, programme: number, conversation: number | null, text: string) {
  const key = draftKey(account, programme, conversation);
  drafts.set(key, text);
  unsaved.add(key);
  if (!saveTimer) saveTimer = setTimeout(flushDrafts, saveDelayMs);
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') flushDrafts();
});

const conversations = new Map<string, number | null>();

function threadKey(account: string, programme: number) {
  return `${account}.${programme}`;
}

export function openConversation(account: string, programme: number, conversation: number | null) {
  conversations.set(threadKey(account, programme), conversation);
  notify();
}

export function useOpenConversation(account: string, programme: number): number | null {
  return useSyncExternalStore(subscribe, () => conversations.get(threadKey(account, programme)) ?? null);
}

export function hasOpenConversation(account: string, programme: number): boolean {
  return conversations.has(threadKey(account, programme));
}

onAccountForgotten((account) => {
  flushDrafts();
  for (const key of Storage.getAllKeysSync()) {
    if (key.startsWith(`discovery.draft.${account}.`) || key === lastKey(account)) Storage.removeItemSync(key);
  }
  for (const key of [...drafts.keys()]) if (key.startsWith(`discovery.draft.${account}.`)) drafts.delete(key);
  for (const key of [...conversations.keys()]) if (key.startsWith(`${account}.`)) conversations.delete(key);
  notify();
});

function lastKey(account: string) {
  return `discovery.programme.${account}`;
}

export function lastProgramme(account: string): number | null {
  const stored = Number(Storage.getItemSync(lastKey(account)));
  return Number.isInteger(stored) && stored > 0 ? stored : null;
}

export function rememberProgramme(account: string, programme: number) {
  Storage.setItemSync(lastKey(account), String(programme));
  notify();
}

export function useLastProgramme(account: string | null): number | null {
  return useSyncExternalStore(subscribe, () => (account ? lastProgramme(account) : null));
}
