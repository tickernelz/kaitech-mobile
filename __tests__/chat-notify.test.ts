jest.mock('react-native', () => ({ Platform: { OS: 'android', Version: 35 }, AppRegistry: { registerHeadlessTask: jest.fn() } }));
jest.mock('../src/auth/session', () => ({ getSession: () => ({ accounts: [] }) }));
jest.mock('../src/features/call/native', () => ({ callNative: () => null }));
jest.mock('../src/features/chat/api', () => ({
  ChatClient: class {},
  sendErrorFrom: (error: { retry?: boolean }) => ({ retry: error.retry ?? true }),
}));

import type { Account } from '../src/auth/oauth';
import { mutedEntries, mutedForever, mutedUntilMs, runMessageTask } from '../src/features/chat/notify';

const now = Date.UTC(2026, 10, 21, 8, 0, 0);
const account = { id: 'u7_x', db: 'lab0', userId: 7, origin: 'https://lab0.kaitech.io', partnerId: 70, deviceId: 3, name: 'A', login: 'a', signedInAt: 0 } as Account;
const other = { ...account, id: 'u7_y', db: 'other' } as Account;
const refusal = (retry: boolean) => Object.assign(new Error(retry ? 'network' : 'forbidden'), { retry });

function harness(outcomes: (Error | null)[]) {
  const posted: { key: string; channelId: number; body: string }[] = [];
  const results: [string, number, number, string, boolean][] = [];
  const read: [number, number][] = [];
  const waits: number[] = [];
  const deps = {
    accounts: () => [account, other],
    client: (target: Account) => {
      expect(target).toBe(account);
      return {
        post: async (input: { key: string; channelId: number; body: string }) => {
          posted.push({ key: input.key, channelId: input.channelId, body: input.body });
          const outcome = outcomes.shift() ?? null;
          if (outcome) throw outcome;
          return { messageId: 99, data: null };
        },
        markAsRead: async (channelId: number, messageId: number) => {
          read.push([channelId, messageId]);
          return {};
        },
      } as never;
    },
    native: () => ({
      messageResult: async (db: string, uid: number, channelId: number, sendKey: string, ok: boolean) => {
        results.push([db, uid, channelId, sendKey, ok]);
        return true;
      },
    }),
    wait: async (ms: number) => void waits.push(ms),
  };
  return { deps, posted, results, read, waits };
}

describe('mute state from the server', () => {
  it('reads an Odoo UTC datetime without a zone as UTC', () => {
    expect(mutedUntilMs('2026-11-21 16:00:00', now)).toBe(Date.UTC(2026, 10, 21, 16, 0, 0));
  });

  it('treats a past mute as not muted', () => {
    expect(mutedUntilMs('2026-11-21 07:59:59', now)).toBeNull();
    expect(mutedUntilMs(null, now)).toBeNull();
    expect(mutedUntilMs('soon', now)).toBeNull();
  });

  it('treats a far future date as muted for good', () => {
    expect(mutedForever('9999-12-31 23:59:59', now)).toBe(true);
    expect(mutedForever('2026-11-28 08:00:00', now)).toBe(false);
  });

  it('mirrors only the conversations that are muted now', () => {
    expect(
      mutedEntries(
        [
          { id: 1, mutedUntil: '2026-11-21 16:00:00' },
          { id: 2, mutedUntil: null },
          { id: 3, mutedUntil: '2026-11-20 16:00:00' },
          { id: 4, mutedUntil: '9999-12-31 23:59:59' },
        ],
        now,
      ),
    ).toEqual({ ids: [1, 4], until: [Date.UTC(2026, 10, 21, 16, 0, 0), Number.MAX_SAFE_INTEGER] });
  });
});

describe('reply from a notification', () => {
  const reply = { kind: 'reply', db: 'lab0', uid: 7, channelId: 12, text: ' see you <b>soon</b> ', sendKey: 'k-1' };

  it('posts once to the conversation of the push account and reports success', async () => {
    const run = harness([null]);
    await runMessageTask(reply, run.deps);
    expect(run.posted).toEqual([{ key: 'k-1', channelId: 12, body: 'see you &lt;b&gt;soon&lt;/b&gt;' }]);
    expect(run.results).toEqual([['lab0', 7, 12, 'k-1', true]]);
  });

  it('retries a lost connection with the same send key so the server keeps one message', async () => {
    const run = harness([refusal(true), null]);
    await runMessageTask(reply, run.deps);
    expect(run.posted.map((item) => item.key)).toEqual(['k-1', 'k-1']);
    expect(run.waits).toEqual([3000]);
    expect(run.results).toEqual([['lab0', 7, 12, 'k-1', true]]);
  });

  it('stops on a refusal and reports the reply as not sent', async () => {
    const run = harness([refusal(false)]);
    await runMessageTask(reply, run.deps);
    expect(run.posted).toHaveLength(1);
    expect(run.results).toEqual([['lab0', 7, 12, 'k-1', false]]);
  });

  it('reports a reply for an account no longer signed in as not sent without posting', async () => {
    const run = harness([]);
    await runMessageTask({ ...reply, db: 'gone' }, run.deps);
    expect(run.posted).toEqual([]);
    expect(run.results).toEqual([['gone', 7, 12, 'k-1', false]]);
  });
});

describe('mark as read from a notification', () => {
  it('marks the conversation read up to the last notified message', async () => {
    const run = harness([]);
    await runMessageTask({ kind: 'read', db: 'lab0', uid: 7, channelId: 12, messageId: 340 }, run.deps);
    expect(run.read).toEqual([[12, 340]]);
    expect(run.posted).toEqual([]);
  });
});
