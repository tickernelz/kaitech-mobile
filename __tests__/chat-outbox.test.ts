import { Outbox, SendError, type Transport } from '../src/features/chat/outbox';
import type { Pending } from '../src/features/chat/types';

function pending(key: string, extra: Partial<Pending> = {}): Pending {
  return {
    key,
    accountId: 'a',
    channelId: 1,
    text: key,
    parentId: null,
    mentions: [],
    files: [],
    createdAt: Number(key.replace(/\D/g, '')) || 0,
    attempts: 0,
    state: 'queued',
    error: null,
    ...extra,
  };
}

function memoryStore() {
  const saved = new Map<string, Pending>();
  return {
    saved,
    store: {
      save: async (item: Pending) => {
        saved.set(item.key, item);
      },
      remove: async (key: string) => {
        saved.delete(key);
      },
    },
  };
}

class FlakyServer implements Transport {
  messages: string[] = [];
  byKey = new Map<string, number>();
  uploads = new Map<string, number>();
  calls = 0;
  constructor(private readonly fate: (call: number) => 'ok' | 'drop-request' | 'drop-answer') {}

  async upload(_item: Pending, file: Pending['files'][number]) {
    const fate = this.fate(++this.calls);
    if (fate === 'drop-request') throw new SendError('network', true);
    const attachmentId = this.uploads.get(file.key) ?? this.uploads.size + 1;
    this.uploads.set(file.key, attachmentId);
    if (fate === 'drop-answer') throw new SendError('network', true);
    return { attachmentId, ownershipToken: `t${attachmentId}` };
  }

  async post(item: Pending) {
    const fate = this.fate(++this.calls);
    if (fate === 'drop-request') throw new SendError('network', true);
    let id = this.byKey.get(item.key);
    if (id === undefined) {
      this.messages.push(item.text);
      id = this.messages.length;
      this.byKey.set(item.key, id);
    }
    if (fate === 'drop-answer') throw new SendError('network', true);
    return { messageId: id, data: null };
  }
}

async function drain(outbox: Outbox, rounds = 200) {
  for (let i = 0; i < rounds && outbox.list().length; i++) await outbox.flush();
}

describe('Outbox', () => {
  it('delivers 50 messages exactly once, in order, while the network drops requests and answers', async () => {
    const fates = ['ok', 'drop-answer', 'ok', 'drop-request', 'drop-answer', 'ok', 'ok'] as const;
    const server = new FlakyServer((call) => fates[call % fates.length]);
    const { store, saved } = memoryStore();
    const sent: number[] = [];
    const outbox = new Outbox(server, store, () => undefined, (item) => sent.push(item.messageId));
    for (let i = 1; i <= 50; i++) await outbox.add(pending(`m${String(i).padStart(2, '0')}`));
    await drain(outbox);
    expect(server.messages).toEqual(Array.from({ length: 50 }, (_, i) => `m${String(i + 1).padStart(2, '0')}`));
    expect(new Set(sent).size).toBe(50);
    expect(outbox.list()).toEqual([]);
    expect(saved.size).toBe(0);
  });

  it('uploads each file once and keeps its attachment when the post fails', async () => {
    let posts = 0;
    const upload = jest.fn(async () => ({ attachmentId: 9, ownershipToken: 'tok' }));
    const post = jest.fn(async () => {
      posts += 1;
      if (posts === 1) throw new SendError('network', true);
      return { messageId: 77, data: null };
    });
    const { store, saved } = memoryStore();
    const outbox = new Outbox({ upload, post }, store, () => undefined, () => undefined);
    const file = { key: 'f1', uri: 'file:///a.m4a', name: 'a.m4a', mimetype: 'audio/mp4', size: 3, voice: true, durationMs: 1000, attachmentId: null, ownershipToken: null };
    await outbox.add(pending('m1', { files: [file] }));
    await outbox.flush();
    expect(saved.get('m1')?.files[0]).toMatchObject({ attachmentId: 9, ownershipToken: 'tok' });
    await outbox.flush();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'm1' }), [{ attachmentId: 9, ownershipToken: 'tok' }]);
    expect(outbox.list()).toEqual([]);
  });

  it('stops at a retryable failure so later messages never overtake earlier ones', async () => {
    const order: string[] = [];
    let down = true;
    const transport: Transport = {
      upload: async () => ({ attachmentId: 1, ownershipToken: 't' }),
      post: async (item) => {
        if (down) throw new SendError('network', true);
        order.push(item.key);
        return { messageId: order.length, data: null };
      },
    };
    const outbox = new Outbox(transport, memoryStore().store, () => undefined, () => undefined);
    await outbox.add(pending('m1'));
    await outbox.add(pending('m2'));
    await outbox.flush();
    expect(outbox.list().map((item) => [item.key, item.state, item.attempts])).toEqual([
      ['m1', 'queued', 1],
      ['m2', 'queued', 0],
    ]);
    down = false;
    await outbox.flush();
    expect(order).toEqual(['m1', 'm2']);
  });

  it('parks a refused message as failed, lets the rest go, and retries it on request', async () => {
    const refused = new Set(['m1']);
    const transport: Transport = {
      upload: async () => ({ attachmentId: 1, ownershipToken: 't' }),
      post: async (item) => {
        if (refused.has(item.key)) throw new SendError('forbidden', false);
        return { messageId: 5, data: null };
      },
    };
    const outbox = new Outbox(transport, memoryStore().store, () => undefined, () => undefined);
    await outbox.add(pending('m1'));
    await outbox.add(pending('m2'));
    await outbox.flush();
    expect(outbox.list().map((item) => [item.key, item.state, item.error])).toEqual([['m1', 'failed', 'forbidden']]);
    refused.clear();
    await outbox.retry('m1');
    await outbox.flush();
    expect(outbox.list()).toEqual([]);
  });

  it('turns a message left sending by a killed app back into queued', () => {
    const outbox = new Outbox(new FlakyServer(() => 'ok'), memoryStore().store, () => undefined, () => undefined);
    outbox.load([pending('m1', { state: 'sending', attempts: 1 })]);
    expect(outbox.list()[0].state).toBe('queued');
  });
});
