import { useSyncExternalStore } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { accountFolderName, attachmentFolderName, openedFolderName } from '../cleanup';
import type { Attachment } from '../types';

export type MediaMeta = { width?: number; height?: number; durationMs?: number; pages?: number; preview?: string };

export const openedRoot = 'chat-opened';
const indexName = 'media.json';
const saveDelayMs = 400;

type Book = { entries: Map<string, MediaMeta>; timer: ReturnType<typeof setTimeout> | null };

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

function bookOf(accountId: string): Book {
  const known = books.get(accountId);
  if (known) return known;
  const book: Book = { entries: new Map(), timer: null };
  try {
    const file = indexFile(accountId);
    if (file.exists) {
      const raw: unknown = JSON.parse(file.textSync());
      if (raw && typeof raw === 'object') {
        for (const [key, value] of Object.entries(raw)) if (value && typeof value === 'object') book.entries.set(key, value as MediaMeta);
      }
    }
  } catch {
    book.entries.clear();
  }
  books.set(accountId, book);
  return book;
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
