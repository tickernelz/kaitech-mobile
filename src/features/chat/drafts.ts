import { cachedDraft, storeDraft, type Draft } from './db';

const drafts = new Map<string, Draft>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const empty: Draft = { text: '', parentId: null, mentions: [] };

function keyOf(account: string, channel: number) {
  return `${account}:${channel}`;
}

export function readDraft(account: string, channel: number): Draft {
  const key = keyOf(account, channel);
  const known = drafts.get(key);
  if (known) return known;
  const stored = cachedDraft(account, channel) ?? empty;
  drafts.set(key, stored);
  return stored;
}

export function writeDraft(account: string, channel: number, draft: Draft) {
  const key = keyOf(account, channel);
  drafts.set(key, draft);
  const pending = timers.get(key);
  if (pending) clearTimeout(pending);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      storeDraft(account, channel, draft);
    }, 300),
  );
}

export function clearDraft(account: string, channel: number) {
  writeDraft(account, channel, empty);
}

const anchors = new Map<string, number>();

export function readAnchor(account: string, channel: number): number | null {
  return anchors.get(keyOf(account, channel)) ?? null;
}

export function writeAnchor(account: string, channel: number, messageId: number | null) {
  const key = keyOf(account, channel);
  if (messageId === null) anchors.delete(key);
  else anchors.set(key, messageId);
}
