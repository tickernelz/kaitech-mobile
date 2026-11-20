import { accountForPush } from '../src/features/call/account';

jest.mock('../src/auth/session', () => ({ getSession: () => ({ accounts: [] }) }));

const accounts = [
  { id: 'a', db: 'lab0', userId: 7 },
  { id: 'b', db: 'lab0', userId: 9 },
  { id: 'c', db: 'other', userId: 7 },
];

describe('routing a call action to its account', () => {
  it('picks the one account that matches db and uid', () => {
    expect(accountForPush({ db: 'lab0', uid: 9 }, accounts)?.id).toBe('b');
    expect(accountForPush({ db: 'other', uid: 7 }, accounts)?.id).toBe('c');
  });

  it('does nothing when the account is unknown', () => {
    expect(accountForPush({ db: 'lab0', uid: 5 }, accounts)).toBeNull();
    expect(accountForPush({ db: '', uid: 7 }, accounts)).toBeNull();
    expect(accountForPush({ db: 'lab0' }, accounts)).toBeNull();
  });

  it('does nothing when two accounts share db and uid', () => {
    const twins = [...accounts, { id: 'd', db: 'lab0', userId: 7 }];
    expect(accountForPush({ db: 'lab0', uid: 7 }, twins)).toBeNull();
  });
});
