import { AppError } from '../src/auth/errors';
import type { Account } from '../src/auth/oauth';
import { ApiError, bearer, rpc } from '../src/api/odoo';

const mockMarkExpired = jest.fn();

jest.mock('../src/auth/session', () => {
  const forgotten: ((id: string) => void)[] = [];
  return {
    markExpired: (id: string) => mockMarkExpired(id),
    onAccountForgotten: (listener: (id: string) => void) => forgotten.push(listener),
    forget: (id: string) => forgotten.forEach((listener) => listener(id)),
    tokenFor: async () => 'device-token',
  };
});
jest.mock('../src/i18n', () => ({ __esModule: true, default: { language: 'id' } }));

const account: Account = {
  id: 'u2_test',
  origin: 'https://erp.example.com',
  db: 'erp',
  userId: 2,
  partnerId: 3,
  deviceId: 4,
  name: 'Tester',
  login: 'tester',
  signedInAt: 0,
};

type Call = { url: string; init: RequestInit };

function serve(answers: ((call: Call) => { status?: number; body: unknown })[]) {
  const calls: Call[] = [];
  global.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    const next = answers.shift();
    if (!next) throw new Error(`unexpected call ${call.url}`);
    const { status = 200, body } = next(call);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return calls;
}

const session = (id: string) => () => ({ body: { session_id: id, expires_in: 3600 } });

beforeEach(() => {
  jest.requireMock<{ forget: (id: string) => void }>('../src/auth/session').forget('u2_test');
});

describe('rpc', () => {
  it('opens a session, sends it as the cookie, and asks in the app language', async () => {
    const calls = serve([session('s1'), () => ({ body: { result: [1, 2] } })]);
    await expect(rpc(account, 'ck.engagement', 'chat_contexts')).resolves.toEqual([1, 2]);
    expect(calls[0].url).toBe('https://erp.example.com/kaitech_mobile/session');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer device-token');
    expect(calls[1].url).toBe('https://erp.example.com/web/dataset/call_kw/ck.engagement/chat_contexts');
    expect((calls[1].init.headers as Record<string, string>).Cookie).toBe('session_id=s1');
    expect(JSON.parse(String(calls[1].init.body)).params.kwargs.context).toEqual({ lang: 'id_ID' });
  });

  it('renews an expired session once and repeats the call', async () => {
    const calls = serve([
      session('s1'),
      () => ({ body: { error: { code: 100, data: { name: 'odoo.http.SessionExpiredException' } } } }),
      session('s2'),
      () => ({ body: { result: 'ok' } }),
    ]);
    await expect(rpc(account, 'ck.engagement', 'programme_panel', [[7]])).resolves.toBe('ok');
    expect((calls[1].init.headers as Record<string, string>).Cookie).toBe('session_id=s1');
    expect((calls[3].init.headers as Record<string, string>).Cookie).toBe('session_id=s2');
  });

  it('turns an Odoo access error into a stable code', async () => {
    serve([session('s1'), () => ({ body: { error: { code: 200, data: { name: 'odoo.exceptions.AccessError' } } } })]);
    const failure = await rpc(account, 'ck.finding', 'search_read').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('forbidden');
  });

  it('keeps the context a caller passes, such as the password of an identity check, next to the app language', async () => {
    const calls = serve([session('s1'), () => ({ body: { result: true } })]);
    await rpc(account, 'res.users.identitycheck', 'run_check', [[5]], { context: { password: 'secret' } });
    expect(JSON.parse(String(calls[1].init.body)).params.kwargs.context).toEqual({ password: 'secret', lang: 'id_ID' });
  });

  it('keeps the words of a user error and drops those of an access error', async () => {
    serve([
      session('s1'),
      () => ({ body: { error: { code: 200, data: { name: 'odoo.exceptions.UserError', message: 'Rekaman ini masih diunggah.' } } } }),
      () => ({ body: { error: { code: 200, data: { name: 'odoo.exceptions.AccessError', message: 'ck.mom.recording (id=4) rule' } } } }),
    ]);
    const refused = (await rpc(account, 'ck.mom.recording', 'transcribe').catch((error: unknown) => error)) as ApiError;
    expect([refused.code, refused.reason]).toEqual(['refused', 'Rekaman ini masih diunggah.']);
    const forbidden = (await rpc(account, 'ck.mom.recording', 'transcribe').catch((error: unknown) => error)) as ApiError;
    expect([forbidden.code, forbidden.reason]).toEqual(['forbidden', '']);
  });
});

describe('bearer', () => {
  it('passes the server error code through', async () => {
    serve([() => ({ status: 409, body: { error: 'conflict', error_code: 'card_not_awaiting' } })]);
    const failure = await bearer(account, '/kaitech_mobile/discovery/answer', { method: 'POST', body: {} }).catch((error: unknown) => error);
    expect((failure as ApiError).code).toBe('card_not_awaiting');
    expect((failure as ApiError).status).toBe(409);
  });

  it('marks the session expired when the token is refused', async () => {
    mockMarkExpired.mockClear();
    serve([() => ({ status: 401, body: { error: 'invalid_token', error_code: 'token_invalid' } })]);
    const failure = await bearer(account, '/kaitech_mobile/search', { query: { q: 'lembur' } }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('sessionEnded');
    expect(mockMarkExpired.mock.calls).toEqual([['u2_test']]);
  });
});
