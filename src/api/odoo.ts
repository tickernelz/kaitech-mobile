import { AppError } from '../auth/errors';
import { call, headers, type Account } from '../auth/oauth';
import { markExpired, onAccountForgotten, tokenFor } from '../auth/session';
import i18n from '../i18n';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

type Session = { id: string; until: number };

const renewBeforeMs = 60_000;
const sessions = new Map<string, Promise<Session>>();
const serverLanguages = { en: 'en_US', id: 'id_ID' } as const;

function ended(account: Account): never {
  markExpired(account.id);
  throw new AppError('sessionEnded');
}

async function tokenOf(account: Account): Promise<string> {
  return (await tokenFor(account.id)) ?? ended(account);
}

function refused(account: Account, status: number, body: Record<string, unknown> | null): never {
  if (status === 401) ended(account);
  const code = typeof body?.error_code === 'string' ? body.error_code : status >= 500 ? 'server' : 'unknown';
  throw new ApiError(code, status);
}

function queryOf(query?: Record<string, string | number>): string {
  if (!query) return '';
  const pairs = Object.entries(query).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export async function bearer<T>(
  account: Account,
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string | number> } = {},
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

type RpcFailure = { code?: unknown; data?: { name?: unknown } };

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
  const lang = serverLanguages[i18n.language === 'id' ? 'id' : 'en'];
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
        params: { model, method, args, kwargs: { ...kwargs, context: { lang } } },
      }),
    });
    if (status !== 200) refused(account, status, body);
    const failure = body?.error as RpcFailure | undefined;
    if (!failure) return body?.result as T;
    if (attempt === 0 && expired(failure)) continue;
    throw new ApiError(rpcCode(typeof failure.data?.name === 'string' ? failure.data.name : ''), status);
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
    throw new ApiError(failure.code === 404 || /NotFound$/.test(name) ? 'not_found' : rpcCode(name), status);
  }
}

