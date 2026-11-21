import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { AppError } from './errors';
import { codeFromCallback, exchangeCode, redirectUriFor, signInUrl, type Account } from './oauth';
import { createPkce } from './pkce';
import { normalizeDatabase, normalizeServer } from './server';
import { addAccount } from './session';

const pendingKey = 'pendingSignIn';
const pendingTtlMs = 10 * 60 * 1000;
const secure = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

type Pending = { origin: string; db: string; verifier: string; state: string; redirectUri: string; language: string; at: number };

let callbackUrl: string | null = null;
let exchanging: Promise<Account> | null = null;

export function isSignInCallback(url: string): boolean {
  return url.split('?')[0].endsWith('/kaitech_mobile/callback');
}

export function stashCallback(url: string) {
  callbackUrl = url;
}

export function takeStashedCallback(): string | null {
  const url = callbackUrl;
  callbackUrl = null;
  return url;
}

function linkHost(): string {
  const host: unknown = Constants.expoConfig?.extra?.linkHost;
  if (typeof host !== 'string' || !host) throw new AppError('linkNotConfigured');
  return host;
}

export type ServerChoice = { server: string; database: string };

export function defaultServer(): ServerChoice | null {
  const extra = Constants.expoConfig?.extra;
  const server: unknown = extra?.linkHost;
  const database: unknown = extra?.defaultDatabase;
  if (typeof server !== 'string' || !server || typeof database !== 'string' || !database) return null;
  return { server, database };
}

function deviceName(): string {
  return Device.deviceName ?? Device.modelName ?? 'Kaitech';
}

async function readPending(): Promise<Pending | null> {
  const raw = await SecureStore.getItemAsync(pendingKey, secure);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as Pending;
    return Date.now() - pending.at < pendingTtlMs ? pending : null;
  } catch {
    return null;
  }
}

async function finish(url: string): Promise<Account> {
  const pending = await readPending();
  await SecureStore.deleteItemAsync(pendingKey, secure);
  if (!pending) throw new AppError('codeExpired');
  const code = codeFromCallback(url, pending);
  const grant = await exchangeCode(pending.origin, pending.db, {
    code,
    verifier: pending.verifier,
    redirectUri: pending.redirectUri,
    language: pending.language,
  });
  return addAccount(pending.origin, grant);
}

export function completeSignIn(url: string): Promise<Account> {
  exchanging ??= finish(url).finally(() => {
    exchanging = null;
  });
  return exchanging;
}

export async function signIn(server: string, database: string, language: string): Promise<Account> {
  const origin = normalizeServer(server);
  const db = normalizeDatabase(database);
  const redirectUri = redirectUriFor(linkHost());
  const pkce = await createPkce();
  const pending: Pending = { origin, db, verifier: pkce.verifier, state: pkce.state, redirectUri, language, at: Date.now() };
  await SecureStore.setItemAsync(pendingKey, JSON.stringify(pending), secure);
  const url = signInUrl({
    origin,
    db,
    redirectUri,
    challenge: pkce.challenge,
    state: pkce.state,
    deviceName: deviceName(),
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    language,
  });
  const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
  const stashed = takeStashedCallback();
  if (result.type === 'success') return completeSignIn(result.url);
  if (stashed) return completeSignIn(stashed);
  if (exchanging) return exchanging;
  await SecureStore.deleteItemAsync(pendingKey, secure);
  throw new AppError('cancelled');
}
