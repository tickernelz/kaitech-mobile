import { useSyncExternalStore } from 'react';
import { Directory, DownloadTask, File, Paths } from 'expo-file-system';
import { accountFolderName, openedFolderName, safeName } from '../cleanup';
import { forgetMeta, openedRoot } from './meta';

export type FileKey = { accountId: string; attachmentId: number; checksum: string | null };
export type FileStatus = { state: 'idle' } | { state: 'downloading'; received: number; total: number } | { state: 'done' } | { state: 'failed' };

export class DownloadCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'DownloadCancelled';
  }
}

type Flight = { task: DownloadTask; promise: Promise<File>; cancelled: boolean };

const idle: FileStatus = { state: 'idle' };
const done: FileStatus = { state: 'done' };
const failed: FileStatus = { state: 'failed' };
const progressEveryMs = 120;

const flights = new Map<string, Flight>();
const statuses = new Map<string, FileStatus>();
const listeners = new Map<string, Set<() => void>>();

function idOf(key: FileKey, name: string): string {
  return `${openedFolderName(key.accountId, key.attachmentId, key.checksum)}/${safeName(name)}`;
}

export function targetFile(key: FileKey, name: string): File {
  return new File(Paths.cache, openedRoot, idOf(key, name));
}

function dropQuietly(entry: File | Directory) {
  try {
    if (entry.exists) entry.delete();
  } catch {
    return;
  }
}

function publish(id: string, status: FileStatus) {
  statuses.set(id, status);
  listeners.get(id)?.forEach((listener) => listener());
}

export function fileStatus(key: FileKey, name: string): FileStatus {
  const id = idOf(key, name);
  const known = statuses.get(id);
  if (known) return known;
  let present = false;
  try {
    const file = targetFile(key, name);
    present = file.exists && (file.size ?? 0) > 0;
  } catch {
    present = false;
  }
  const status = present ? done : idle;
  statuses.set(id, status);
  return status;
}

export function fetchFile(key: FileKey, url: string, name: string, headers: Record<string, string>, fresh = false): Promise<File> {
  const id = idOf(key, name);
  const running = flights.get(id);
  if (running && !fresh) return running.promise;
  const target = targetFile(key, name);
  if (!fresh && target.exists && (target.size ?? 0) > 0) {
    publish(id, done);
    return Promise.resolve(target);
  }
  const directory = target.parentDirectory;
  directory.create({ intermediates: true, idempotent: true });
  const part = new File(directory, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.part`);
  let shown = 0;
  const task = new DownloadTask(url, part, {
    headers,
    onProgress: ({ bytesWritten, totalBytes }) => {
      const now = Date.now();
      if (now - shown < progressEveryMs) return;
      shown = now;
      publish(id, { state: 'downloading', received: bytesWritten, total: totalBytes });
    },
  });
  const flight: Flight = { task, cancelled: false, promise: Promise.resolve(target) };
  flight.promise = (async () => {
    try {
      const downloaded = await task.downloadAsync();
      if (!downloaded || flight.cancelled) throw new DownloadCancelled();
      dropQuietly(target);
      downloaded.moveSync(target);
      publish(id, done);
      return new File(target.uri);
    } catch (error) {
      publish(id, flight.cancelled ? idle : failed);
      throw flight.cancelled ? new DownloadCancelled() : error;
    } finally {
      if (flights.get(id) === flight) flights.delete(id);
      dropQuietly(part);
    }
  })();
  flights.set(id, flight);
  publish(id, { state: 'downloading', received: 0, total: 0 });
  return flight.promise;
}

export function cancelFile(key: FileKey, name: string) {
  const flight = flights.get(idOf(key, name));
  if (!flight) return;
  flight.cancelled = true;
  flight.task.cancel();
}

export function useFileStatus(key: FileKey | null, name: string): FileStatus {
  const id = key ? idOf(key, name) : '';
  return useSyncExternalStore(
    (listener) => {
      if (!id) return () => undefined;
      let set = listeners.get(id);
      if (!set) listeners.set(id, (set = new Set()));
      set.add(listener);
      return () => {
        set.delete(listener);
        if (!set.size) listeners.delete(id);
      };
    },
    () => (key ? fileStatus(key, name) : idle),
  );
}

export function forgetFiles(accountId: string) {
  const prefix = `${accountFolderName(accountId)}/`;
  for (const [id, flight] of flights) {
    if (!id.startsWith(prefix)) continue;
    flight.cancelled = true;
    flight.task.cancel();
  }
  for (const id of [...statuses.keys()]) if (id.startsWith(prefix)) statuses.delete(id);
  forgetMeta(accountId);
  dropQuietly(new Directory(Paths.cache, openedRoot, accountFolderName(accountId)));
  for (const [id, set] of listeners) if (id.startsWith(prefix)) set.forEach((listener) => listener());
}
