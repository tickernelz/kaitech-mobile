import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { resetLock } from '../lock/lock';
import { sameAccess, type Access } from './access';
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

export async function addAccount(origin: string, grant: Grant, access?: Access): Promise<Account> {
  const { token, ...rest } = grant;
  const account: Account = { ...rest, id: accountId(origin, grant.db, grant.userId), origin, signedInAt: Date.now(), ...(access ? { access } : {}) };
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

export function markExpired(id: string) {
  if (state.activeId === id) set({ expired: true });
}

const forgetListeners = new Set<(id: string) => void>();

export function onAccountForgotten(listener: (id: string) => void) {
  forgetListeners.add(listener);
}

const leaveHooks = new Set<(account: Account) => Promise<void>>();
export const leaveHookMs = 4000;

export function beforeAccountLeaves(hook: (account: Account) => Promise<void>): () => void {
  leaveHooks.add(hook);
  return () => leaveHooks.delete(hook);
}

async function leaving(id: string) {
  const account = state.accounts.find((candidate) => candidate.id === id);
  if (!account || !leaveHooks.size) return;
  const all = Promise.all([...leaveHooks].map((hook) => hook(account).catch(() => undefined)));
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([all, new Promise<void>((resolve) => (timer = setTimeout(resolve, leaveHookMs)))]);
  clearTimeout(timer);
}

async function forget(id: string) {
  await SecureStore.deleteItemAsync(tokenKey(id), secure);
  forgetListeners.forEach((listener) => listener(id));
  const remaining = state.accounts.filter((account) => account.id !== id);
  set({
    accounts: remaining,
    activeId: state.activeId === id ? (remaining[0]?.id ?? null) : state.activeId,
    expired: false,
  });
  if (remaining.length === 0) resetLock();
}

export type SignOutResult = 'revoked' | 'local';

export function accountKnown(id: string): boolean {
  return state.accounts.some((account) => account.id === id);
}

export function renameAccount(id: string, name: string) {
  if (!state.accounts.some((account) => account.id === id && account.name !== name)) return;
  set({ accounts: state.accounts.map((account) => (account.id === id ? { ...account, name } : account)) });
}

export function noteAccess(id: string, access: Access | null) {
  if (!access || !state.accounts.some((account) => account.id === id && !sameAccess(account.access, access))) return;
  set({ accounts: state.accounts.map((account) => (account.id === id ? { ...account, access } : account)) });
}

export async function signOut(id: string): Promise<SignOutResult> {
  await leaving(id);
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
  await leaving(id);
  await forget(id);
}

export async function verifyActiveSession() {
  const id = state.activeId;
  const account = state.accounts.find((candidate) => candidate.id === id);
  if (!account) return;
  const token = await tokenFor(account.id);
  if (!token) {
    markExpired(account.id);
    return;
  }
  if ((await checkSession(account, token)) === 'ended') markExpired(account.id);
}
