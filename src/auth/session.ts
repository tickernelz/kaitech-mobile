import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { resetLock } from '../lock/lock';
import { checkSession, revokeDevice, type Account, type Grant } from './oauth';

export type SessionState = {
  accounts: Account[];
  activeId: string | null;
  expired: boolean;
  onboarded: boolean;
};

const keys = { accounts: 'accounts', active: 'activeAccount', onboarded: 'onboarded' } as const;
const secure = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function readAccounts(): Account[] {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(keys.accounts) ?? '[]');
    return Array.isArray(parsed) ? (parsed as Account[]) : [];
  } catch {
    return [];
  }
}

const accounts = readAccounts();
const storedActive = Storage.getItemSync(keys.active);

let state: SessionState = {
  accounts,
  activeId: accounts.some((account) => account.id === storedActive) ? storedActive : (accounts[0]?.id ?? null),
  expired: false,
  onboarded: Storage.getItemSync(keys.onboarded) === '1',
};

const listeners = new Set<() => void>();

function set(next: Partial<SessionState>) {
  state = { ...state, ...next };
  Storage.setItemSync(keys.accounts, JSON.stringify(state.accounts));
  if (state.activeId) Storage.setItemSync(keys.active, state.activeId);
  else Storage.removeItemSync(keys.active);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): SessionState & { active: Account | null } {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  return { ...snapshot, active: snapshot.accounts.find((account) => account.id === snapshot.activeId) ?? null };
}

export function getSession(): SessionState {
  return state;
}

function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(36);
}

export function accountId(origin: string, db: string, userId: number): string {
  return `u${userId}_${hash(`${origin}|${db}`)}`;
}

function tokenKey(id: string): string {
  return `token.${id}`;
}

export function tokenFor(id: string): Promise<string | null> {
  return SecureStore.getItemAsync(tokenKey(id), secure);
}

export async function addAccount(origin: string, grant: Grant): Promise<Account> {
  const { token, ...rest } = grant;
  const account: Account = { ...rest, id: accountId(origin, grant.db, grant.userId), origin, signedInAt: Date.now() };
  await SecureStore.setItemAsync(tokenKey(account.id), token, secure);
  set({
    accounts: [...state.accounts.filter((existing) => existing.id !== account.id), account],
    activeId: account.id,
    expired: false,
  });
  return account;
}

export function switchAccount(id: string) {
  if (state.accounts.some((account) => account.id === id)) set({ activeId: id, expired: false });
}

export function markOnboarded() {
  Storage.setItemSync(keys.onboarded, '1');
  set({ onboarded: true });
}

export function markExpired() {
  if (state.activeId) set({ expired: true });
}

async function forget(id: string) {
  await SecureStore.deleteItemAsync(tokenKey(id), secure);
  const remaining = state.accounts.filter((account) => account.id !== id);
  set({
    accounts: remaining,
    activeId: state.activeId === id ? (remaining[0]?.id ?? null) : state.activeId,
    expired: false,
  });
  if (remaining.length === 0) resetLock();
}

export type SignOutResult = 'revoked' | 'local';

export async function signOut(id: string): Promise<SignOutResult> {
  const account = state.accounts.find((candidate) => candidate.id === id);
  const token = await tokenFor(id);
  let result: SignOutResult = 'local';
  if (account && token) {
    try {
      await revokeDevice(account, token);
      result = 'revoked';
    } catch {
      result = 'local';
    }
  }
  await forget(id);
  return result;
}

export async function removeAccount(id: string) {
  await forget(id);
}

export async function verifyActiveSession() {
  const id = state.activeId;
  const account = state.accounts.find((candidate) => candidate.id === id);
  if (!account) return;
  const token = await tokenFor(account.id);
  if (!token) {
    markExpired();
    return;
  }
  if ((await checkSession(account, token)) === 'ended' && state.activeId === account.id) markExpired();
}
