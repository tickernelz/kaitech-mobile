import * as LocalAuthentication from 'expo-local-authentication';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { onPresenceChange, userInApp } from '../features/call/presence';

export const lockAfterMs = 5 * 60 * 1000;

export type LockMethod = 'faceId' | 'touchId' | 'biometric' | 'passcode';

type LockState = { enabled: boolean; locked: boolean };

const enabledKey = 'appLock';
const enabled = Storage.getItemSync(enabledKey) === '1';
let state: LockState = { enabled, locked: enabled };
let backgroundAt: number | null = null;
let authenticating = false;
const listeners = new Set<() => void>();

function set(next: Partial<LockState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function shouldLock(enabledNow: boolean, leftAt: number | null, now: number): boolean {
  return enabledNow && leftAt !== null && now - leftAt >= lockAfterMs;
}

onPresenceChange((next) => {
  if (authenticating) return;
  if (next === 'background' && backgroundAt === null) backgroundAt = Date.now();
  if (next === 'active' && userInApp(next)) {
    if (shouldLock(state.enabled, backgroundAt, Date.now())) set({ locked: true });
    backgroundAt = null;
  }
});

export function onLockChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLock(): LockState {
  return useSyncExternalStore(onLockChange, () => state);
}

export function lockEnabled(): boolean {
  return state.enabled;
}

export async function lockMethod(): Promise<LockMethod | null> {
  const [hardware, enrolled, level, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (!hardware || !enrolled) return level === LocalAuthentication.SecurityLevel.NONE ? null : 'passcode';
  if (Platform.OS !== 'ios') return 'biometric';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'faceId';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'touchId';
  return 'biometric';
}

export async function authenticate(prompt: string, cancel: string): Promise<boolean> {
  authenticating = true;
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: cancel });
    return result.success;
  } finally {
    authenticating = false;
  }
}

export async function setLockEnabled(next: boolean, prompt: string, cancel: string): Promise<boolean> {
  if (next && !(await authenticate(prompt, cancel))) return false;
  Storage.setItemSync(enabledKey, next ? '1' : '0');
  set({ enabled: next, locked: false });
  return true;
}

export async function unlock(prompt: string, cancel: string): Promise<boolean> {
  const ok = await authenticate(prompt, cancel);
  if (ok) set({ locked: false });
  return ok;
}

export async function deviceHasScreenLock(): Promise<boolean> {
  return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
}

export function resetLock() {
  Storage.removeItemSync(enabledKey);
  set({ enabled: false, locked: false });
}
