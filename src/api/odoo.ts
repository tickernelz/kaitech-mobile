import { File, UploadType } from 'expo-file-system';
import { AppError } from '../auth/errors';
import { call, headers, type Account } from '../auth/oauth';
import { markExpired, onAccountForgotten, tokenFor } from '../auth/session';
import i18n from '../i18n';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly detail: string | null = null,
    readonly reason: string | null = null,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

type Session = { id: string; until: number };

const renewBeforeMs = 60_000;
const sessions = new Map<string, Promise<Session>>();
const serverLanguages = { en: 'en_US', id: 'id_ID' } as const;

export function serverLanguage(): string {
  return serverLanguages[i18n.language === 'id' ? 'id' : 'en'];
}

function ended(account: Account): never {
  markExpired(account.id);
  throw new AppError('sessionEnded');
}

async function tokenOf(account: Account): Promise<string> {
  return (await tokenFor(account.id)) ?? ended(account);
}

export async function bearerHeaders(account: Account): Promise<Record<string, string>> {
  return headers(account.db, await tokenOf(account));
}

function refused(account: Account, status: number, body: Record<string, unknown> | null): never {
  if (status === 401) ended(account);
  const code = typeof body?.error_code === 'string' ? body.error_code : status >= 500 ? 'server' : 'unknown';
  throw new ApiError(code, status, code === 'refused' && typeof body?.message === 'string' ? body.message : null);
}

function queryOf(query?: Record<string, string | number>): string {
  if (!query) return '';
  const pairs = Object.entries(query).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export async function bearer<T>(
  account: Account,
  path: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; query?: Record<string, string | number> } = {},
): Promise<T> {
  const { status, body } = await call(`${account.origin}${path}${queryOf(init.query)}`, {
    method: init.method ?? 'GET',
    credentials: 'omit',
    headers: headers(account.db, await tokenOf(account)),
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  if (status !== 200) refused(account, status, body);
  return body as T;
}

const slowestUplinkBytesPerSecond = 32 * 1024;
const uploadGraceMs = 60_000;

export function uploadDeadlineMs(bytes: number): number {
  return uploadGraceMs + Math.ceil((bytes * 1000) / slowestUplinkBytesPerSecond);
}

export async function bearerUpload<T>(account: Account, path: string, body: unknown, onProgress: (fraction: number) => void): Promise<T> {
  const token = await tokenOf(account);
  const payload = JSON.stringify(body);
  const { status, answer } = await new Promise<{ status: number; answer: Record<string, unknown> | null }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${account.origin}${path}`);
    request.withCredentials = false;
    Object.entries(headers(account.db, token)).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.timeout = uploadDeadlineMs(payload.length);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      let parsed: unknown = null;
      try {
        parsed = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        parsed = null;
      }
      resolve({ status: request.status, answer: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null });
    };
    request.onerror = () => reject(new AppError('network'));
    request.ontimeout = () => reject(new AppError('network'));
    request.send(payload);
  });
  if (status !== 200) refused(account, status, answer);
  return answer as T;
}

export async function bearerFile<T>(account: Account, path: string, uri: string, mimeType: string): Promise<T> {
  const token = await tokenOf(account);
  const file = new File(uri);
  if (!file.exists) throw new ApiError('file_missing', 400);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), uploadDeadlineMs(file.size ?? 0));
  let answer: { status: number; body: string };
  try {
    answer = await file.upload(`${account.origin}${path}`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(account.db ? { 'X-Odoo-Database': account.db } : {}) },
      signal: controller.signal,
    });
  } catch {
    throw new AppError('network');
  } finally {
    clearTimeout(timer);
  }
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(answer.body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (answer.status !== 200) refused(account, answer.status, body);
  return body as T;
}

async function openSession(account: Account): Promise<Session> {
  const started = Date.now();
  const answer = await bearer<{ session_id?: unknown; expires_in?: unknown }>(account, '/kaitech_mobile/session', {
    method: 'POST',
    body: {},
  });
  if (typeof answer?.session_id !== 'string' || typeof answer.expires_in !== 'number') throw new AppError('unsupported');
  return { id: answer.session_id, until: started + answer.expires_in * 1000 - renewBeforeMs };
}

const sessionListeners = new Set<(accountId: string) => void>();

export function onSessionOpened(listener: (accountId: string) => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

async function sessionFor(account: Account, renew: boolean): Promise<Session> {
  const held = sessions.get(account.id);
  if (held && !renew) {
    const session = await held.catch(() => null);
    if (session && session.until > Date.now()) return session;
  }
  const opened = openSession(account);
  sessions.set(account.id, opened);
  void opened.then(() => sessionListeners.forEach((listener) => listener(account.id)), () => undefined);
  opened.catch(() => {
    if (sessions.get(account.id) === opened) sessions.delete(account.id);
  });
  return opened;
}

onAccountForgotten((accountId) => sessions.delete(accountId));

type RpcFailure = { code?: unknown; data?: { name?: unknown; message?: unknown; arguments?: unknown; context?: unknown } };

function refusalReason(failure: RpcFailure): string | null {
  const args = failure.data?.arguments;
  return Array.isArray(args) && typeof args[1] === 'string' && /^[a-z_]{1,64}$/.test(args[1]) ? args[1] : null;
}

function shownDetail(failure: RpcFailure, code: string): string | null {
  return (code === 'refused' || code === 'role_required') && typeof failure.data?.message === 'string' ? failure.data.message : null;
}

function neededRole(failure: RpcFailure): string | null {
  const context = failure.data?.context;
  if (!context || typeof context !== 'object') return null;
  const { code, needed } = context as Record<string, unknown>;
  return code === 'role_required' && typeof needed === 'string' ? needed : null;
}

function rpcCode(name: string): string {
  if (/\.(AccessError|AccessDenied)$/.test(name)) return 'forbidden';
  if (name.endsWith('.MissingError')) return 'not_found';
  if (/\.(UserError|ValidationError)$/.test(name)) return 'refused';
  return 'server';
}

function expired(failure: RpcFailure): boolean {
  const name = typeof failure.data?.name === 'string' ? failure.data.name : '';
  return failure.code === 100 || name.endsWith('SessionExpiredException');
}

export async function rpc<T>(
  account: Account,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  const lang = serverLanguage();
  for (let attempt = 0; ; attempt += 1) {
    const session = await sessionFor(account, attempt > 0);
    const { status, body } = await call(`${account.origin}/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      credentials: 'omit',
      headers: { ...headers(account.db), Cookie: `session_id=${session.id}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        id: attempt,
        params: { model, method, args, kwargs: { ...kwargs, context: { ...(kwargs.context as Record<string, unknown> | undefined), lang } } },
      }),
    });
    if (status !== 200) refused(account, status, body);
    const failure = body?.error as RpcFailure | undefined;
    if (!failure) return body?.result as T;
    if (attempt === 0 && expired(failure)) continue;
    const needed = neededRole(failure);
    const code = needed ? 'role_required' : rpcCode(typeof failure.data?.name === 'string' ? failure.data.name : '');
    throw new ApiError(code, status, shownDetail(failure, code), needed);
  }
}

export async function sessionCookie(account: Account, renew = false): Promise<string> {
  return `session_id=${(await sessionFor(account, renew)).id}`;
}

export async function route<T>(account: Account, path: string, params: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const session = await sessionFor(account, attempt > 0);
    const { status, body } = await call(`${account.origin}${path}`, {
      method: 'POST',
      credentials: 'omit',
      headers: { ...headers(account.db), Cookie: `session_id=${session.id}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: attempt, params }),
    });
    if (status === 404) throw new ApiError('not_found', status);
    if (status !== 200) refused(account, status, body);
    const failure = body?.error as RpcFailure | undefined;
    if (!failure) return body?.result as T;
    if (attempt === 0 && expired(failure)) continue;
    const name = typeof failure.data?.name === 'string' ? failure.data.name : '';
    const code = failure.code === 404 || /NotFound$/.test(name) ? 'not_found' : rpcCode(name);
    throw new ApiError(code, status, shownDetail(failure, code), code === 'refused' ? refusalReason(failure) : null);
  }
}

