export type ErrorCode =
  | 'serverRequired'
  | 'serverInvalid'
  | 'serverInsecure'
  | 'databaseInvalid'
  | 'network'
  | 'cancelled'
  | 'accessDenied'
  | 'stateMismatch'
  | 'codeExpired'
  | 'sessionEnded'
  | 'server'
  | 'unsupported'
  | 'linkNotConfigured'
  | 'accountNotTeam'
  | 'accountInactive'
  | 'unknown';

export class AppError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = 'AppError';
  }
}

const byServerCode: Record<string, ErrorCode> = {
  sign_in_cancelled: 'cancelled',
  account_not_team: 'accountNotTeam',
  account_inactive: 'accountInactive',
  code_unknown: 'codeExpired',
  code_expired: 'codeExpired',
  code_mismatch: 'codeExpired',
  token_invalid: 'sessionEnded',
  client_unknown: 'unsupported',
  redirect_not_allowed: 'unsupported',
  response_type_unsupported: 'unsupported',
  pkce_required: 'unsupported',
  state_invalid: 'unsupported',
  device_name_invalid: 'unsupported',
  platform_invalid: 'unsupported',
  grant_type_unsupported: 'unsupported',
  code_missing: 'unsupported',
  body_invalid: 'unsupported',
  locale_invalid: 'unsupported',
};

export type ServerError = { error?: unknown; error_code?: unknown } | null;

export function errorFromServer(status: number, body: ServerError): ErrorCode {
  const code = typeof body?.error_code === 'string' ? byServerCode[body.error_code] : undefined;
  if (code) return code;
  if (body?.error === 'access_denied') return 'accessDenied';
  if (body?.error === 'invalid_token' || status === 401) return 'sessionEnded';
  if (status >= 500) return 'server';
  if (status === 404) return 'unsupported';
  return 'unknown';
}

export function errorCodeOf(error: unknown): ErrorCode {
  return error instanceof AppError ? error.code : 'unknown';
}
