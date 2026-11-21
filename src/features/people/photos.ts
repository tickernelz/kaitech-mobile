import Storage from 'expo-sqlite/kv-store';
import { useCallback, useSyncExternalStore } from 'react';
import { accountKnown, onAccountForgotten } from '../../auth/session';
import { photoFrom, photosInStore, settle, type Photo, type PhotoEntry } from './photo';

const saveDelayMs = 2000;
const keepEntries = 2000;

const books = new Map<string, Map<number, PhotoEntry>>();
const listeners = new Set<() => void>();
const unsaved = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function storageKey(accountId: string): string {
  return `people.photos.${accountId}`;
}

function bookOf(accountId: string): Map<number, PhotoEntry> {
  let book = books.get(accountId);
  if (book) return book;
  book = new Map();
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(storageKey(accountId)) ?? '[]');
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        if (!Array.isArray(row) || typeof row[0] !== 'number' || typeof row[1]?.at !== 'number') continue;
        const photo = photoFrom(row[1].photo);
        if (photo !== undefined) book.set(row[0], { photo, at: row[1].at });
      }
    }
  } catch {
    book.clear();
  }
  books.set(accountId, book);
  return book;
}

function save() {
  saveTimer = null;
  for (const accountId of unsaved) {
    const book = books.get(accountId);
    if (!book) continue;
    const rows = [...book.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, keepEntries);
    Storage.setItemSync(storageKey(accountId), JSON.stringify(rows));
  }
  unsaved.clear();
}

export function notePhotoList(accountId: string, list: Iterable<readonly [number, Photo | null]>) {
  if (!accountKnown(accountId)) return;
  const book = bookOf(accountId);
  const now = Date.now();
  let changed = false;
  for (const [partnerId, photo] of list) {
    const next = settle(book.get(partnerId), photo, now);
    if (!next) continue;
    book.set(partnerId, next);
    changed = true;
  }
  if (!changed) return;
  unsaved.add(accountId);
  if (!saveTimer) saveTimer = setTimeout(save, saveDelayMs);
  listeners.forEach((listener) => listener());
}

export function notePhoto(accountId: string, partnerId: number, photo: Photo | null) {
  notePhotoList(accountId, [[partnerId, photo]]);
}

export function notePhotos(accountId: string | null, store: unknown) {
  if (!accountId) return;
  const found = photosInStore(store);
  if (found.length) notePhotoList(accountId, found);
}

export function partnerPhoto(accountId: string, partnerId: number): Photo | null | undefined {
  return bookOf(accountId).get(partnerId)?.photo;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePartnerPhoto(accountId: string | null, partnerId: number | null | undefined): Photo | null | undefined {
  const read = useCallback(() => (accountId && partnerId ? partnerPhoto(accountId, partnerId) : undefined), [accountId, partnerId]);
  return useSyncExternalStore(subscribe, read);
}

onAccountForgotten((accountId) => {
  books.delete(accountId);
  unsaved.delete(accountId);
  Storage.removeItemSync(storageKey(accountId));
  listeners.forEach((listener) => listener());
});
