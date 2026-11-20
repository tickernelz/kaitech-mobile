import { accountForPush, registeredKey, syncPushToken, type KeyValue } from '../src/features/chat/pushAccount';

function memory(): KeyValue & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, get: (key) => values.get(key) ?? null, set: (key, value) => void values.set(key, value) };
}

describe('syncPushToken', () => {
  it('registers again after the same account signs in on a new device row', async () => {
    const store = memory();
    const registerPush = jest.fn(async () => undefined);
    const first = { id: 'u7_abc', deviceId: 11 };
    await syncPushToken({ store, account: first, token: 'fcm-1', language: 'id', registerPush });
    await syncPushToken({ store, account: first, token: 'fcm-1', language: 'id', registerPush });
    expect(registerPush).toHaveBeenCalledTimes(1);
    await syncPushToken({ store, account: { ...first, deviceId: 12 }, token: 'fcm-1', language: 'id', registerPush });
    expect(registerPush).toHaveBeenCalledTimes(2);
  });

  it('registers again when the token or language changes and remembers only after success', async () => {
    const store = memory();
    const account = { id: 'u7_abc', deviceId: 11 };
    const failing = jest.fn(async () => {
      throw new Error('offline');
    });
    await expect(syncPushToken({ store, account, token: 'fcm-1', language: 'en', registerPush: failing })).rejects.toThrow('offline');
    expect(store.values.has(registeredKey)).toBe(false);
    const registerPush = jest.fn(async () => undefined);
    await syncPushToken({ store, account, token: 'fcm-1', language: 'en', registerPush });
    await syncPushToken({ store, account, token: 'fcm-2', language: 'en', registerPush });
    await syncPushToken({ store, account, token: 'fcm-2', language: 'id', registerPush });
    expect(registerPush.mock.calls).toEqual([
      ['fcm-1', 'en'],
      ['fcm-2', 'en'],
      ['fcm-2', 'id'],
    ]);
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
