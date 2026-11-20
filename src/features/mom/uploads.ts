import * as BackgroundTask from 'expo-background-task';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { fetch as nativeFetch } from 'expo/fetch';
import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
import * as TaskManager from 'expo-task-manager';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { ApiError } from '../../api/odoo';
import { invalidate } from '../../api/resource';
import { call, headers } from '../../auth/oauth';
import { getSession, onAccountForgotten, tokenFor } from '../../auth/session';
import { Sha256 } from './sha256';
import { advance, isPending, PartRefused, type Upload, type UploadDeps } from './upload';

const storageKey = 'mom.uploads.v1';
const taskName = 'kaitech-mom-uploads';
const readChunk = 1024 * 1024;
const partTimeoutMs = 5 * 60_000;
const keepDoneMs = 24 * 60 * 60_000;

function load(): Upload[] {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(storageKey) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return (parsed as Upload[])
      .filter((row) => row.state !== 'done' || now - row.createdAt < keepDoneMs)
      .map((row) => (row.state === 'sending' ? { ...row, state: 'queued' } : row));
  } catch {
    return [];
  }
}

let rows: Upload[] = load();
const listeners = new Set<() => void>();
const inFlight = new Set<AbortController>();

function persist(next: Upload[]) {
  rows = next;
  Storage.setItemSync(storageKey, JSON.stringify(rows));
  listeners.forEach((listener) => listener());
}

function put(row: Upload) {
  const index = rows.findIndex((existing) => existing.key === row.key);
  persist(index < 0 ? [...rows, row] : rows.map((existing, at) => (at === index ? row : existing)));
}

export function localFile(path: string): File {
  return new File(Paths.document, path);
}

export function documentPath(uri: string): string {
  const root = Paths.document.uri;
  return uri.startsWith(root) ? uri.slice(root.length) : uri.replace(/^.*?\/(Audio|ExpoAudio)\//, '$1/');
}

function base64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    out += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? alphabet[c & 63] : '=';
  }
  return out;
}

async function request<T>(upload: Upload, path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const account = getSession().accounts.find((candidate) => candidate.id === upload.account);
  const token = account ? await tokenFor(account.id) : null;
  if (!account || !token) throw new ApiError('token_invalid', 401);
  const answer = await call(`${account.origin}${path}`, {
    method,
    credentials: 'omit',
    headers: headers(account.db, token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (answer.status !== 200) {
    const code = typeof answer.body?.error_code === 'string' ? answer.body.error_code : answer.status >= 500 ? 'server' : 'unknown';
    throw new ApiError(code, answer.status);
  }
  return answer.body as T;
}

async function read(upload: Upload, offset: number, length: number): Promise<Uint8Array<ArrayBuffer>> {
  const handle = localFile(upload.file).open();
  try {
    handle.offset = offset;
    return await handle.readBytes(length);
  } finally {
    handle.close();
  }
}

async function fingerprint(upload: Upload): Promise<string> {
  const hash = new Sha256();
  const handle = localFile(upload.file).open();
  try {
    for (;;) {
      const chunk = await handle.readBytes(readChunk);
      if (!chunk.length) break;
      hash.update(chunk);
    }
  } finally {
    handle.close();
  }
  return hash.hex();
}

async function sendPart(url: string, bytes: Uint8Array<ArrayBuffer>, checksum: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), partTimeoutMs);
  inFlight.add(controller);
  try {
    let response;
    try {
      response = await nativeFetch(url, { method: 'PUT', body: bytes, headers: { 'Content-MD5': checksum }, signal: controller.signal });
    } catch {
      throw new PartRefused(408);
    }
    if (!response.ok) throw new PartRefused(response.status);
    const etag = response.headers.get('etag');
    if (!etag) throw new PartRefused(502);
    return etag;
  } finally {
    clearTimeout(timer);
    inFlight.delete(controller);
  }
}

let deadline = 0;

const deps: UploadDeps = {
  request,
  exists: (upload) => localFile(upload.file).exists,
  read,
  md5: async (bytes) => base64(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.MD5, bytes))),
  fingerprint,
  put: sendPart,
  save: put,
  remove: (upload) => {
    const file = localFile(upload.file);
    if (file.exists) file.delete();
  },
  stopped: () => deadline > 0 && Date.now() > deadline,
};

let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function signedIn(account: string): boolean {
  return getSession().accounts.some((candidate) => candidate.id === account);
}

function next(now: number): Upload | undefined {
  return rows.find(
    (row) =>
      signedIn(row.account) &&
      (row.state === 'queued' || (row.state === 'waiting' && (row.retryAt ?? 0) <= now) || row.state === 'signedOut'),
  );
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  const soonest = Math.min(...rows.filter((row) => row.state === 'waiting').map((row) => row.retryAt ?? 0));
  if (Number.isFinite(soonest)) timer = setTimeout(() => void drain(), Math.max(1_000, soonest - Date.now()));
  void syncBackgroundTask();
}

const tried = new Set<string>();

export function drain(until = 0): Promise<void> {
  if (running) return running;
  deadline = until;
  running = (async () => {
    tried.clear();
    for (;;) {
      if (deadline && Date.now() > deadline) break;
      const row = next(Date.now());
      if (!row || tried.has(row.key)) break;
      if (row.state === 'signedOut') tried.add(row.key);
      const after = await advance(row, deps);
      if (after.state === 'done') invalidate(`${row.account}:mom.`);
    }
  })().finally(() => {
    running = null;
    deadline = 0;
    schedule();
  });
  return running;
}

export function enqueue(upload: Upload) {
  put(upload);
  void drain();
}

export function retry(key: string) {
  const row = rows.find((candidate) => candidate.key === key);
  if (!row || row.state === 'done' || row.state === 'sending') return;
  put({ ...row, state: 'queued', error: undefined, retryAt: undefined, attempts: 0 });
  void drain();
}

export async function discard(key: string) {
  const row = rows.find((candidate) => candidate.key === key);
  if (!row || row.state === 'sending') return;
  if (row.recordingId && row.state !== 'done') {
    await request(row, `/kaitech_mobile/mom/upload/${row.recordingId}/abort`, 'POST', {}).catch(() => undefined);
  }
  deps.remove(row);
  persist(rows.filter((candidate) => candidate.key !== key));
}

export function dismiss(key: string) {
  persist(rows.filter((candidate) => candidate.key !== key || isPending(candidate) || candidate.state === 'failed'));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUploads(account: string | null): Upload[] {
  const all = useSyncExternalStore(subscribe, () => rows);
  return account ? all.filter((row) => row.account === account) : [];
}

export function uploadsOf(account: string): Upload[] {
  return rows.filter((row) => row.account === account);
}

onAccountForgotten((account) => {
  for (const row of rows) if (row.account === account) deps.remove(row);
  persist(rows.filter((row) => row.account !== account));
});

TaskManager.defineTask(taskName, async () => {
  try {
    await drain(Date.now() + 25_000);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

let registered: boolean | null = null;

async function syncBackgroundTask() {
  const wanted = rows.some((row) => row.state === 'queued' || row.state === 'waiting');
  if (registered === wanted) return;
  registered = wanted;
  try {
    if (wanted) await BackgroundTask.registerTaskAsync(taskName, { minimumInterval: 15 });
    else if (await TaskManager.isTaskRegisteredAsync(taskName)) await BackgroundTask.unregisterTaskAsync(taskName);
  } catch {
    registered = null;
  }
}

Network.addNetworkStateListener((state) => {
  if (state.isConnected === false || state.isInternetReachable === false) {
    inFlight.forEach((controller) => controller.abort());
    return;
  }
  persist(rows.map((row) => (row.state === 'waiting' ? { ...row, retryAt: undefined } : row)));
  void drain();
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') void drain();
});

void drain();
