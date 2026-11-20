import { Directory, File, Paths } from 'expo-file-system';
import { newKey } from './chat';
import { orphanStaging } from './cleanup';

const folder = 'chat-outbox';
const openedFolder = 'chat-opened';

function stagingDirectory(): Directory {
  const directory = new Directory(Paths.document, folder, newKey());
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(-120) || 'file';
}

export function stageFile(uri: string, name: string): { uri: string; size: number } {
  const target = new File(stagingDirectory(), safeName(name));
  new File(uri).copy(target);
  const staged = new File(target.uri);
  return { uri: staged.uri, size: staged.size ?? 0 };
}

export function adoptFile(uri: string, name: string): { uri: string; size: number } {
  const target = new File(stagingDirectory(), safeName(name));
  new File(uri).move(target);
  const staged = new File(target.uri);
  return { uri: staged.uri, size: staged.size ?? 0 };
}

export function dropFile(uri: string) {
  try {
    const file = new File(uri);
    const directory = file.parentDirectory;
    if (directory.parentDirectory.name === folder) {
      if (directory.exists) directory.delete();
    } else if (file.exists) {
      file.delete();
    }
  } catch {
    return;
  }
}

export function sweepStaging(referencedUris: string[]) {
  try {
    const root = new Directory(Paths.document, folder);
    if (!root.exists) return;
    const folders = root.list().filter((entry): entry is Directory => entry instanceof Directory);
    const orphans = new Set(orphanStaging(folders.map((entry) => entry.uri), referencedUris));
    for (const entry of folders) if (orphans.has(entry.uri)) entry.delete();
  } catch {
    return;
  }
}

export function clearOpenedFiles() {
  try {
    const directory = new Directory(Paths.cache, openedFolder);
    if (directory.exists) directory.delete();
  } catch {
    return;
  }
}

export async function downloadForOpening(url: string, name: string, headers: Record<string, string>): Promise<File> {
  const directory = new Directory(Paths.cache, openedFolder, newKey());
  directory.create({ intermediates: true, idempotent: true });
  return File.downloadFileAsync(url, new File(directory, safeName(name)), { headers, idempotent: true });
}
