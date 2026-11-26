import { useSyncExternalStore } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { accountFolderName, attachmentFolderName, openedFolderName } from '../cleanup';
import type { Attachment } from '../types';

export type MediaMeta = { width?: number; height?: number; durationMs?: number; pages?: number; preview?: string };

export const openedRoot = 'chat-opened';
const indexName = 'media.json';
const saveDelayMs = 400;

type Book = { entries: Map<string, MediaMeta>; timer: ReturnType<typeof setTimeout> | null; ready: Promise<void> };

const books = new Map<string, Book>();
const epochs = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

export function epochOf(accountId: string): number {
  return epochs.get(accountId) ?? 0;
}

export function mediaKey(attachment: Pick<Attachment, 'id' | 'checksum'>): string {
  return attachmentFolderName(attachment.id, attachment.checksum);
}

export function cacheFile(relative: string): File {
  return new File(Paths.cache, openedRoot, relative);
}

export function previewPath(accountId: string, attachment: Pick<Attachment, 'id' | 'checksum'>, name: string): string {
  return `${openedFolderName(accountId, attachment.id, attachment.checksum)}/.preview/${name}`;
}

function indexFile(accountId: string): File {
  return new File(Paths.cache, openedRoot, accountFolderName(accountId), indexName);
}

async function readIndex(accountId: string): Promise<Record<string, MediaMeta>> {
  try {
    const file = indexFile(accountId);
    if (!file.exists) return {};
    const raw: unknown = JSON.parse(await file.text());
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(Object.entries(raw).filter(([, value]) => value && typeof value === 'object')) as Record<string, MediaMeta>;
  } catch {
    return {};
  }
}

function bookOf(accountId: string): Book {
  const known = books.get(accountId);
  if (known) return known;
  const book: Book = { entries: new Map(), timer: null, ready: Promise.resolve() };
  books.set(accountId, book);
  book.ready = readIndex(accountId).then((stored) => {
    if (books.get(accountId) !== book) return;
    const fresh = Object.entries(stored).filter(([key]) => !book.entries.has(key));
    for (const [key, value] of fresh) book.entries.set(key, value);
    for (const [key] of fresh) listeners.get(listenerKey(accountId, key))?.forEach((listener) => listener());
  });
  return book;
}

export function metaReady(accountId: string): Promise<void> {
  return bookOf(accountId).ready;
}

export function discardLate(accountId: string, epoch: number, relative: string): boolean {
  if (epoch === epochOf(accountId)) return false;
  try {
    let entry: File | Directory = cacheFile(relative);
    if (entry.exists) entry.delete();
    const account = new Directory(Paths.cache, openedRoot, accountFolderName(accountId)).uri;
    entry = entry.parentDirectory;
    while (entry.uri.startsWith(account) && entry.exists && entry.list().length === 0) {
      const parent: Directory = entry.parentDirectory;
      entry.delete();
      entry = parent;
    }
  } catch {
    return true;
  }
  return true;
}

function persist(accountId: string, book: Book) {
  if (book.timer) return;
  book.timer = setTimeout(() => {
    book.timer = null;
    if (books.get(accountId) !== book) return;
    try {
      new Directory(Paths.cache, openedRoot, accountFolderName(accountId)).create({ intermediates: true, idempotent: true });
      indexFile(accountId).writeSync(JSON.stringify(Object.fromEntries(book.entries)));
    } catch {
      return;
    }
  }, saveDelayMs);
}

function listenerKey(accountId: string, key: string): string {
  return `${accountId}|${key}`;
}

export function cachedMeta(accountId: string, attachment: Pick<Attachment, 'id' | 'checksum'>): MediaMeta | undefined {
  return bookOf(accountId).entries.get(mediaKey(attachment));
}

export function rememberMeta(accountId: string, attachment: Pick<Attachment, 'id' | 'checksum'>, next: MediaMeta, epoch = epochOf(accountId)) {
  if (epoch !== epochOf(accountId)) return;
  const book = bookOf(accountId);
  const key = mediaKey(attachment);
  book.entries.set(key, { ...book.entries.get(key), ...next });
  persist(accountId, book);
  listeners.get(listenerKey(accountId, key))?.forEach((listener) => listener());
}

export function forgetMeta(accountId: string) {
  epochs.set(accountId, epochOf(accountId) + 1);
  const book = books.get(accountId);
  if (book?.timer) clearTimeout(book.timer);
  books.delete(accountId);
  const prefix = `${accountId}|`;
  for (const [key, set] of listeners) if (key.startsWith(prefix)) set.forEach((listener) => listener());
}

export function resolveMeta(attachment: Attachment, cached: MediaMeta | undefined): MediaMeta {
  const server = attachment.media;
  return {
    width: server?.width ?? cached?.width,
    height: server?.height ?? cached?.height,
    durationMs: cached?.durationMs,
    pages: server?.pages ?? cached?.pages,
    preview: cached?.preview,
  };
}

export function useMediaMeta(accountId: string | null, attachment: Attachment): MediaMeta {
  const key = accountId ? listenerKey(accountId, mediaKey(attachment)) : '';
  const cached = useSyncExternalStore(
    (listener) => {
      if (!key) return () => undefined;
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(listener);
      return () => {
        set.delete(listener);
        if (!set.size) listeners.delete(key);
      };
    },
    () => (accountId ? cachedMeta(accountId, attachment) : undefined),
  );
  return resolveMeta(attachment, cached);
}
