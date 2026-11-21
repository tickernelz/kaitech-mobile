import { accountForPush, registeredKey, syncPreview, syncPushToken, type KeyValue } from '../src/features/chat/pushAccount';

function memory(): KeyValue & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, get: (key) => values.get(key) ?? null, set: (key, value) => void values.set(key, value) };
}

describe('syncPushToken', () => {
  it('registers again after the same account signs in on a new device row', async () => {
    const store = memory();
    const registerPush = jest.fn(async () => undefined);
    const first = { id: 'u7_abc', deviceId: 11 };
    await syncPushToken({ store, account: first, token: 'fcm-1', language: 'id', preview: true, registerPush });
    await syncPushToken({ store, account: first, token: 'fcm-1', language: 'id', preview: true, registerPush });
    expect(registerPush).toHaveBeenCalledTimes(1);
    await syncPushToken({ store, account: { ...first, deviceId: 12 }, token: 'fcm-1', language: 'id', preview: true, registerPush });
    expect(registerPush).toHaveBeenCalledTimes(2);
  });

  it('registers again when the token, language or preview changes and remembers only after success', async () => {
    const store = memory();
    const account = { id: 'u7_abc', deviceId: 11 };
    const failing = jest.fn(async () => {
      throw new Error('offline');
    });
    await expect(syncPushToken({ store, account, token: 'fcm-1', language: 'en', preview: true, registerPush: failing })).rejects.toThrow('offline');
    expect(store.values.has(registeredKey)).toBe(false);
    const registerPush = jest.fn(async () => undefined);
    await syncPushToken({ store, account, token: 'fcm-1', language: 'en', preview: true, registerPush });
    await syncPushToken({ store, account, token: 'fcm-2', language: 'en', preview: true, registerPush });
    await syncPushToken({ store, account, token: 'fcm-2', language: 'id', preview: true, registerPush });
    await syncPushToken({ store, account, token: 'fcm-2', language: 'id', preview: false, registerPush });
    expect(registerPush.mock.calls).toEqual([
      ['fcm-1', 'en', true],
      ['fcm-2', 'en', true],
      ['fcm-2', 'id', true],
      ['fcm-2', 'id', false],
    ]);
  });
});

describe('syncPreview', () => {
  it('turns previews off on every signed-in device row and retries only the rows that failed', async () => {
    const store = memory();
    const accounts = [
      { id: 'a', deviceId: 1 },
      { id: 'b', deviceId: 2 },
    ];
    let offline = true;
    const setPreview = jest.fn(async (account: { id: string }, preview: boolean) => {
      if (account.id === 'b' && offline && !preview) throw new Error('offline');
    });
    await syncPreview({ store, accounts, preview: false, setPreview });
    offline = false;
    await syncPreview({ store, accounts, preview: false, setPreview });
    await syncPreview({ store, accounts, preview: false, setPreview });
    expect(setPreview.mock.calls.map(([account, preview]) => `${account.id}:${preview}`)).toEqual(['a:false', 'b:false', 'b:false']);
  });

  it('turns previews off for two accounts on different servers whose device rows share an id', async () => {
    const store = memory();
    const accounts = [
      { id: 'u7_lab0hash', deviceId: 5 },
      { id: 'u3_otherhash', deviceId: 5 },
    ];
    const setPreview = jest.fn(async (_account: { id: string }, _preview: boolean) => undefined);
    await syncPreview({ store, accounts, preview: false, setPreview });
    expect(setPreview.mock.calls.map(([account, preview]) => `${account.id}:${preview}`)).toEqual(['u7_lab0hash:false', 'u3_otherhash:false']);
  });

  it('skips a device row whose registration already carried the same preview', async () => {
    const store = memory();
    const account = { id: 'a', deviceId: 1 };
    await syncPushToken({ store, account, token: 'fcm-1', language: 'en', preview: false, registerPush: async () => undefined });
    const setPreview = jest.fn(async () => undefined);
    await syncPreview({ store, accounts: [account], preview: false, setPreview });
    expect(setPreview).not.toHaveBeenCalled();
    await syncPreview({ store, accounts: [account], preview: true, setPreview });
    expect(setPreview).toHaveBeenCalledWith(account, true);
  });
});

describe('accountForPush', () => {
  const accounts = [
    { id: 'a', db: 'lab0', userId: 7 },
    { id: 'b', db: 'other', userId: 7 },
  ];

  it('picks the account the push was sent to and asks to switch when it is not active', () => {
    expect(accountForPush({ db: 'other', uid: '7' }, accounts, 'a')).toEqual({ accountId: 'b', switchTo: true });
    expect(accountForPush({ db: 'lab0', uid: 7 }, accounts, 'a')).toEqual({ accountId: 'a', switchTo: false });
  });

  it('opens nothing when two signed-in accounts share the database name and user id', () => {
    const twins = [...accounts, { id: 'c', db: 'lab0', userId: 7 }];
    expect(accountForPush({ db: 'lab0', uid: '7' }, twins, 'a')).toBeNull();
  });

  it('opens nothing for a push from an account that is not signed in here', () => {
    expect(accountForPush({ db: 'lab0', uid: '8' }, accounts, 'a')).toBeNull();
  });

  it('without a server identity opens only when one account is signed in', () => {
    expect(accountForPush({ res_id: '4' }, accounts, 'a')).toBeNull();
    expect(accountForPush({ res_id: '4' }, [accounts[0]], 'a')).toEqual({ accountId: 'a', switchTo: false });
  });
});
