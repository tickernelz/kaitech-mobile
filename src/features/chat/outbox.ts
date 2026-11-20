import type { Pending, PendingFile } from './types';

export type Uploaded = { attachmentId: number; ownershipToken: string };

export type Transport = {
  upload(pending: Pending, file: PendingFile): Promise<Uploaded>;
  post(pending: Pending, files: Uploaded[]): Promise<number>;
};

export type OutboxStore = {
  save(pending: Pending): Promise<void>;
  remove(key: string): Promise<void>;
};

export class SendError extends Error {
  constructor(
    readonly code: string,
    readonly retry: boolean,
  ) {
    super(code);
    this.name = 'SendError';
  }
}

export function retryDelay(attempts: number): number {
  return Math.min(30000, 1000 * 2 ** Math.max(0, attempts - 1));
}

export type Sent = { key: string; channelId: number; messageId: number };

export class Outbox {
  private items = new Map<string, Pending>();
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private readonly transport: Transport,
    private readonly store: OutboxStore,
    private readonly onChange: (items: Pending[]) => void,
    private readonly onSent: (sent: Sent) => void,
  ) {}

  load(items: Pending[]) {
    for (const item of items) this.items.set(item.key, { ...item, state: item.state === 'sending' ? 'queued' : item.state });
    this.emit();
  }

  list(): Pending[] {
    return [...this.items.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async add(pending: Pending): Promise<void> {
    this.items.set(pending.key, pending);
    this.emit();
    await this.store.save(pending);
  }

  async retry(key: string): Promise<void> {
    const item = this.items.get(key);
    if (!item || item.state !== 'failed') return;
    await this.update({ ...item, state: 'queued', error: null });
  }

  async discard(key: string): Promise<void> {
    if (this.items.get(key)?.state === 'sending') return;
    this.items.delete(key);
    this.emit();
    await this.store.remove(key);
  }

  flush(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async drain(): Promise<void> {
    do {
      this.again = false;
      for (const item of this.list()) {
        if (item.state !== 'queued') continue;
        const stop = await this.send(item);
        if (stop) return;
      }
    } while (this.again);
  }

  private async send(start: Pending): Promise<boolean> {
    let item: Pending = { ...start, state: 'sending', attempts: start.attempts + 1 };
    await this.update(item);
    try {
      const uploaded: Uploaded[] = [];
      for (const [index, file] of item.files.entries()) {
        if (file.attachmentId && file.ownershipToken) {
          uploaded.push({ attachmentId: file.attachmentId, ownershipToken: file.ownershipToken });
          continue;
        }
        const done = await this.transport.upload(item, file);
        const files = item.files.slice();
        files[index] = { ...file, attachmentId: done.attachmentId, ownershipToken: done.ownershipToken };
        item = { ...item, files };
        await this.update(item);
        uploaded.push(done);
      }
      const messageId = await this.transport.post(item, uploaded);
      this.items.delete(item.key);
      this.emit();
      await this.store.remove(item.key);
      this.onSent({ key: item.key, channelId: item.channelId, messageId });
      return false;
    } catch (error) {
      const failure = error instanceof SendError ? error : new SendError('network', true);
      await this.update({ ...item, state: failure.retry ? 'queued' : 'failed', error: failure.code });
      return failure.retry;
    }
  }

  private async update(item: Pending) {
    if (!this.items.has(item.key)) return;
    this.items.set(item.key, item);
    this.emit();
    await this.store.save(item);
  }

  private emit() {
    this.onChange(this.list());
  }
}
