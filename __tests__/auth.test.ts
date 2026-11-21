import { AppError, errorFromServer } from '../src/auth/errors';
import { codeFromCallback, grantFrom, signInUrl } from '../src/auth/oauth';
import { base64Url } from '../src/auth/pkce';
import { normalizeDatabase, normalizeServer } from '../src/auth/server';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof AppError ? error.code : 'not-app-error';
  }
  return 'no-error';
}

describe('normalizeServer', () => {
  it.each([
    ['erp.example.com', 'https://erp.example.com'],
    ['  ERP.Example.com/web/login?x=1 ', 'https://erp.example.com'],
    ['https://erp.example.com:8443/', 'https://erp.example.com:8443'],
    ['https://erp.example.com:443', 'https://erp.example.com'],
  ])('turns %p into %p', (input, origin) => {
    expect(normalizeServer(input)).toBe(origin);
  });

  it.each([
    ['', 'serverRequired'],
    ['http://erp.example.com', 'serverInsecure'],
    ['ftp://erp.example.com', 'serverInvalid'],
    ['https://user@evil.example', 'serverInvalid'],
    ['not a host', 'serverInvalid'],
  ])('refuses %p with %p', (input, code) => {
    expect(codeOf(() => normalizeServer(input))).toBe(code);
  });
});

describe('normalizeDatabase', () => {
  it('keeps a valid name without surrounding spaces', () => {
    expect(normalizeDatabase('  erp_main-2.0 ')).toBe('erp_main-2.0');
  });

  it.each(['', '   '])('leaves the database out for %p', (input) => {
    expect(normalizeDatabase(input)).toBe('');
  });

  it.each([
    ['erp main', 'databaseInvalid'],
    ['-erp', 'databaseInvalid'],
    ['erp/../x', 'databaseInvalid'],
  ])('refuses %p with %p', (input, code) => {
    expect(codeOf(() => normalizeDatabase(input))).toBe(code);
  });
});

describe('signInUrl', () => {
  const request = {
    origin: 'https://erp.example.com',
    db: 'erp_main',
    redirectUri: 'https://link.example.com/kaitech_mobile/callback',
    challenge: 'challenge',
    state: 'state-1234',
    deviceName: 'Pixel 9',
    platform: 'android' as const,
    language: 'id',
  };

  it('asks the server for an S256 code bound to the redirect, device and language', () => {
    const url = new URL(signInUrl({ ...request, db: '' }));
    expect(url.origin + url.pathname).toBe('https://erp.example.com/kaitech_mobile/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'kaitech-mobile',
      response_type: 'code',
      redirect_uri: request.redirectUri,
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      state: 'state-1234',
      device_name: 'Pixel 9',
      platform: 'android',
      ui_locales: 'id',
    });
  });

  it('picks the database through the login page', () => {
    const url = new URL(signInUrl(request));
    expect(url.origin + url.pathname).toBe('https://erp.example.com/web/login');
    expect(url.searchParams.get('db')).toBe('erp_main');
    expect(url.searchParams.get('redirect')?.startsWith('/kaitech_mobile/authorize?')).toBe(true);
  });
});

describe('codeFromCallback', () => {
  const expected = { redirectUri: 'https://link.example.com/kaitech_mobile/callback', state: 'state-1234' };

  it('returns the code when the state matches', () => {
    expect(codeFromCallback(`${expected.redirectUri}?code=abc&state=state-1234`, expected)).toBe('abc');
    expect(codeFromCallback('/kaitech_mobile/callback?state=state-1234&code=abc', expected)).toBe('abc');
  });

  it('rejects a response for another request', () => {
    expect(codeOf(() => codeFromCallback(`${expected.redirectUri}?code=abc&state=other`, expected))).toBe('stateMismatch');
  });

  it('rejects a callback on another host', () => {
    expect(codeOf(() => codeFromCallback('https://evil.example/kaitech_mobile/callback?code=abc&state=state-1234', expected))).toBe(
      'unknown',
    );
  });

  it('words a cancelled sign-in from its stable code', () => {
    const url = `${expected.redirectUri}?error=access_denied&error_code=sign_in_cancelled&state=state-1234`;
    expect(codeOf(() => codeFromCallback(url, expected))).toBe('cancelled');
  });
});

describe('errorFromServer', () => {
  it.each([
    [400, { error: 'invalid_grant', error_code: 'code_expired' }, 'codeExpired'],
    [401, { error: 'invalid_token', error_code: 'token_invalid' }, 'sessionEnded'],
    [401, null, 'sessionEnded'],
    [403, { error: 'access_denied', error_code: 'account_not_team' }, 'accountNotTeam'],
    [502, null, 'server'],
    [404, { error: 'not_found' }, 'unsupported'],
    [400, { error: 'invalid_request', error_code: 'something_new' }, 'unknown'],
  ])('maps %p %p to %p', (status, body, code) => {
    expect(errorFromServer(status, body)).toBe(code);
  });
});

describe('grantFrom', () => {
  it('refuses a token answer missing the device id', () => {
    expect(
      codeOf(() => grantFrom({ access_token: 't', user_id: 2, partner_id: 3, db: 'd', name: 'n', login: 'l' })),
    ).toBe('unsupported');
  });
});

describe('base64Url', () => {
  it('matches Node base64url for every length up to 40 bytes', () => {
    for (let length = 0; length <= 40; length++) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 97 + length * 31 + 7) % 256);
      expect(base64Url(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
    }
  });
});
