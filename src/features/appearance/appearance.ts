import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { bearer } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import { onAccountForgotten } from '../../auth/session';
import { errorCode } from '../chat/api';
import { chatClient, onRealtimeNotifications } from '../chat/chat';

export type Theme = 'system' | 'light' | 'dark';
export type Background = { kind: 'default' } | { kind: 'device' } | { kind: 'color'; value: string } | { kind: 'preset'; value: string };
export type ChatAppearance = { theme: Theme; background: Background; conversations: Record<string, Background> };
export type AppearancePatch = { theme?: Theme; background?: Background; conversations?: Record<string, Background | null> };
export type Scope = 'all' | number;

export const themes: readonly Theme[] = ['system', 'light', 'dark'];
export const plainColors = ['#c4b8de', '#b8c3d4', '#b4d1bd', '#dccb9c', '#dcb0b0', '#3d4a5c', '#2f4a40', '#4a3346'] as const;
export const defaultAppearance: ChatAppearance = { theme: 'system', background: { kind: 'default' }, conversations: {} };

const presetName = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const colorValue = /^#[0-9a-f]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function backgroundFrom(value: unknown): Background | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'default' || value.kind === 'device') return { kind: value.kind };
  const text = typeof value.value === 'string' ? value.value.toLowerCase() : '';
  if (value.kind === 'color' && colorValue.test(text)) return { kind: 'color', value: text };
  if (value.kind === 'preset' && presetName.test(text)) return { kind: 'preset', value: text };
  return null;
}

export function presetBackground(value: string): Background {
  return { kind: 'preset', value };
}

export function appearanceFrom(value: unknown): ChatAppearance {
  if (!isRecord(value)) return defaultAppearance;
  const theme = themes.find((candidate) => candidate === value.theme) ?? 'system';
  const background = backgroundFrom(value.background) ?? defaultAppearance.background;
  const conversations: Record<string, Background> = {};
  if (isRecord(value.conversations)) {
    for (const [id, raw] of Object.entries(value.conversations)) {
      const parsed = /^[1-9]\d*$/.test(id) ? backgroundFrom(raw) : null;
      if (parsed) conversations[id] = parsed;
    }
  }
  return { theme, background, conversations };
}

export function patched(current: ChatAppearance, patch: AppearancePatch): ChatAppearance {
  const conversations = { ...current.conversations };
  for (const [id, background] of Object.entries(patch.conversations ?? {})) {
    if (background) conversations[id] = background;
    else delete conversations[id];
  }
  return { theme: patch.theme ?? current.theme, background: patch.background ?? current.background, conversations };
}

export function backgroundFor(appearance: ChatAppearance, channelId: number): { background: Background; scope: Scope } {
  const own = appearance.conversations[String(channelId)];
  return own ? { background: own, scope: channelId } : { background: appearance.background, scope: 'all' };
}

const held = new Map<string, ChatAppearance>();
const queues = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();
const listeners = new Set<() => void>();

function storageKey(accountId: string): string {
  return `appearance.${accountId}`;
}

function read(accountId: string): ChatAppearance {
  let value = held.get(accountId);
  if (value) return value;
  try {
    value = appearanceFrom(JSON.parse(Storage.getItemSync(storageKey(accountId)) ?? 'null'));
  } catch {
    value = defaultAppearance;
  }
  held.set(accountId, value);
  return value;
}

function put(accountId: string, value: ChatAppearance) {
  held.set(accountId, value);
  Storage.setItemSync(storageKey(accountId), JSON.stringify(value));
  listeners.forEach((listener) => listener());
}

export function takeAppearance(accountId: string, value: unknown) {
  put(accountId, appearanceFrom(value));
}

export function appearanceOf(accountId: string): ChatAppearance {
  return read(accountId);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChatAppearance(accountId: string | null): ChatAppearance {
  const snapshot = useCallback(() => (accountId ? read(accountId) : defaultAppearance), [accountId]);
  return useSyncExternalStore(subscribe, snapshot);
}

export function useAppliedTheme(accountId: string | null) {
  const { theme } = useChatAppearance(accountId);
  useEffect(() => {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  }, [theme]);
}

function serial<T>(accountId: string, task: () => Promise<T>): Promise<T> {
  const next = (queues.get(accountId) ?? Promise.resolve()).then(task, task);
  queues.set(accountId, next.catch(() => undefined));
  return next;
}

export function loadAppearance(account: Account): Promise<void> {
  const generation = generations.get(account.id) ?? 0;
  return serial(account.id, async () => {
    try {
      const answer = await bearer<unknown>(account, '/kaitech_mobile/appearance');
      if ((generations.get(account.id) ?? 0) === generation) takeAppearance(account.id, answer);
    } catch {
      return;
    }
  });
}

export function changeAppearance(account: Account, patch: AppearancePatch): Promise<string | null> {
  const before = read(account.id);
  const generation = generations.get(account.id) ?? 0;
  const current = () => (generations.get(account.id) ?? 0) === generation;
  put(account.id, patched(before, patch));
  return serial(account.id, async () => {
    try {
      const answer = await bearer<unknown>(account, '/kaitech_mobile/appearance', { method: 'POST', body: patch });
      if (current()) takeAppearance(account.id, answer);
      return null;
    } catch (error) {
      if (current()) put(account.id, before);
      return errorCode(error);
    }
  });
}

onRealtimeNotifications((notification) => {
  if (notification.type !== 'res.users.settings' || !isRecord(notification.payload) || !('kaitech_mobile_appearance' in notification.payload)) return;
  const account = chatClient()?.account;
  if (account) void loadAppearance(account);
});

onAccountForgotten((accountId) => {
  generations.set(accountId, (generations.get(accountId) ?? 0) + 1);
  held.delete(accountId);
  queues.delete(accountId);
  Storage.removeItemSync(storageKey(accountId));
  listeners.forEach((listener) => listener());
});
