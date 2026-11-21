import { Directory, File, Paths } from 'expo-file-system';
import { launchImageLibraryAsync } from 'expo-image-picker';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useSyncExternalStore } from 'react';
import { accountKnown, onAccountForgotten } from '../../auth/session';
import { shrinkToJpeg } from '../media/shrink';
import type { Scope } from './appearance';

const folder = 'wallpapers';
const longestSide = 1600;
const maxDim = 0.8;
const listeners = new Set<() => void>();

function photosKey(accountId: string): string {
  return `appearance.devicePhotos.${accountId}`;
}

function dimKey(accountId: string): string {
  return `appearance.dim.${accountId}`;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function names(accountId: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(photosKey(accountId)) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function fileOf(name: string): File {
  return new File(Paths.document, folder, name);
}

export function devicePhotoUri(accountId: string, scope: Scope): string | null {
  const name = names(accountId)[String(scope)];
  if (!name) return null;
  const file = fileOf(name);
  return file.exists ? file.uri : null;
}

export function useDevicePhoto(accountId: string | null, scope: Scope): string | null {
  const snapshot = useCallback(() => (accountId ? devicePhotoUri(accountId, scope) : null), [accountId, scope]);
  return useSyncExternalStore(subscribe, snapshot);
}

export async function pickDevicePhoto(accountId: string, scope: Scope): Promise<boolean> {
  const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset) return false;
  const shrunk = new File(await shrinkToJpeg(asset.uri, asset.width, asset.height, longestSide));
  if (!accountKnown(accountId)) {
    shrunk.delete();
    return false;
  }
  const directory = new Directory(Paths.document, folder);
  if (!directory.exists) directory.create({ intermediates: true });
  const name = `${accountId}-${String(scope)}-${Date.now()}.jpg`;
  shrunk.move(fileOf(name));
  const current = names(accountId);
  const previous = current[String(scope)];
  Storage.setItemSync(photosKey(accountId), JSON.stringify({ ...current, [String(scope)]: name }));
  if (previous && fileOf(previous).exists) fileOf(previous).delete();
  notify();
  return true;
}

export function dimOf(accountId: string): number {
  const value = Number(Storage.getItemSync(dimKey(accountId)) ?? '0');
  return Number.isFinite(value) ? Math.min(maxDim, Math.max(0, value)) : 0;
}

export function setDim(accountId: string, value: number) {
  if (!accountKnown(accountId)) return;
  Storage.setItemSync(dimKey(accountId), String(Math.min(maxDim, Math.max(0, value))));
  notify();
}

export function useDim(accountId: string | null): number {
  const snapshot = useCallback(() => (accountId ? dimOf(accountId) : 0), [accountId]);
  return useSyncExternalStore(subscribe, snapshot);
}

onAccountForgotten((accountId) => {
  for (const name of Object.values(names(accountId))) {
    const file = fileOf(name);
    if (file.exists) file.delete();
  }
  Storage.removeItemSync(photosKey(accountId));
  Storage.removeItemSync(dimKey(accountId));
  notify();
});
