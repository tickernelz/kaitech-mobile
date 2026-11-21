import { AppError, errorFromServer, type ServerError } from './errors';

export const clientId = 'kaitech-mobile';
const timeoutMs = 15000;

export type Account = {
  id: string;
  origin: string;
  db: string;
  userId: number;
  partnerId: number;
  deviceId: number;
  name: string;
  login: string;
  signedInAt: number;
};

export type Grant = Omit<Account, 'id' | 'origin' | 'signedInAt'> & { token: string };

export type SignInRequest = {
  origin: string;
  db: string;
  redirectUri: string;
  challenge: string;
  state: string;
  deviceName: string;
  platform: 'android' | 'ios';
  language: string;
};

export function redirectUriFor(linkHost: string): string {
  return `https://${linkHost}/kaitech_mobile/callback`;
}

function query(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const [key, value = ''] = pair.split('=');
    out[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return out;
}

export function signInUrl(request: SignInRequest): string {
  const authorize = `/kaitech_mobile/authorize?${query({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: request.redirectUri,
    code_challenge: request.challenge,
    code_challenge_method: 'S256',
    state: request.state,
    device_name: request.deviceName.trim().slice(0, 64) || 'Kaitech',
    platform: request.platform,
    ui_locales: request.language,
  })}`;
  return `${request.origin}/web/login?${query({ db: request.db, redirect: authorize })}`;
}

export function codeFromCallback(url: string, expected: { redirectUri: string; state: string }): string {
  const [target, rest = ''] = url.split('?');
  const redirectPath = expected.redirectUri.replace(/^https:\/\/[^/]+/, '');
  if (target !== expected.redirectUri && target !== redirectPath) throw new AppError('unknown');
  const params = parseQuery(rest.split('#')[0]);
  if (params.state !== expected.state) throw new AppError('stateMismatch');
  if (params.error) throw new AppError(errorFromServer(400, params));
  if (!params.code) throw new AppError('unknown');
  return params.code;
}

export async function call(url: string, init: RequestInit): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new AppError('network');
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text().catch(() => '');
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

export function headers(db: string, token?: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(db ? { 'X-Odoo-Database': db } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function grantFrom(body: Record<string, unknown> | null): Grant {
  if (
    !body ||
    typeof body.access_token !== 'string' ||
    !body.access_token ||
    !isId(body.device_id) ||
    !isId(body.user_id) ||
    !isId(body.partner_id) ||
    typeof body.db !== 'string' ||
    typeof body.name !== 'string' ||
    typeof body.login !== 'string'
  ) {
    throw new AppError('unsupported');
  }
  return {
    token: body.access_token,
    deviceId: body.device_id,
    userId: body.user_id,
    partnerId: body.partner_id,
    db: body.db,
    name: body.name,
    login: body.login,
  };
}

export async function exchangeCode(
  origin: string,
  db: string,
  exchange: { code: string; verifier: string; redirectUri: string; language: string },
): Promise<Grant> {
  const { status, body } = await call(`${origin}/kaitech_mobile/token`, {
    method: 'POST',
    headers: headers(db),
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: exchange.code,
      code_verifier: exchange.verifier,
      redirect_uri: exchange.redirectUri,
      locale: exchange.language,
    }),
  });
  if (status !== 200) throw new AppError(errorFromServer(status, body as ServerError));
  return grantFrom(body);
}

export type SessionCheck = 'valid' | 'ended' | 'unknown';

export async function checkSession(account: Account, token: string): Promise<SessionCheck> {
  try {
    const { status, body } = await call(`${account.origin}/kaitech_mobile/devices`, {
      method: 'GET',
      headers: headers(account.db, token),
    });
    if (status === 200) return 'valid';
    return errorFromServer(status, body as ServerError) === 'sessionEnded' ? 'ended' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function revokeDevice(account: Account, token: string): Promise<void> {
  const { status, body } = await call(`${account.origin}/kaitech_mobile/devices/${account.deviceId}/revoke`, {
    method: 'POST',
    headers: headers(account.db, token),
    body: '{}',
  });
  if (status === 200 || status === 401 || status === 404) return;
  throw new AppError(errorFromServer(status, body as ServerError));
}
