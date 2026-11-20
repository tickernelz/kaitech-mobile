import { Directory, File, Paths } from 'expo-file-system';
import { newKey } from './chat';
import { openedFolderName, orphanStaging, relativeStaged, stagingFolder } from './cleanup';

const openedFolder = 'chat-opened';

function stagingDirectory(): Directory {
  const directory = new Directory(Paths.document, stagingFolder, newKey());
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(-120) || 'file';
}

export function localFile(uri: string): File {
  return /^[a-z][a-z0-9+.-]*:/i.test(uri) ? new File(uri) : new File(Paths.document, uri);
}

function staged(target: File): { uri: string; size: number } {
  const file = new File(target.uri);
  return { uri: relativeStaged(Paths.document.uri, file.uri), size: file.size ?? 0 };
}

export function stageFile(uri: string, name: string): { uri: string; size: number } {
  const target = new File(stagingDirectory(), safeName(name));
  new File(uri).copy(target);
  return staged(target);
}

export function adoptFile(uri: string, name: string): { uri: string; size: number } {
  const target = new File(stagingDirectory(), safeName(name));
  new File(uri).move(target);
  return staged(target);
}

export function dropFile(uri: string) {
  try {
    const file = localFile(uri);
    const directory = file.parentDirectory;
    if (directory.parentDirectory.name === stagingFolder) {
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
    const root = new Directory(Paths.document, stagingFolder);
    if (!root.exists) return;
    const folders = root.list().filter((entry): entry is Directory => entry instanceof Directory);
    const orphans = new Set(orphanStaging(folders.map((entry) => entry.name), referencedUris));
    for (const entry of folders) if (orphans.has(entry.name)) entry.delete();
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

export async function downloadForOpening(
  key: { accountId: string; attachmentId: number; checksum: string | null },
  url: string,
  name: string,
  headers: Record<string, string>,
): Promise<File> {
  const directory = new Directory(Paths.cache, openedFolder, openedFolderName(key.accountId, key.attachmentId, key.checksum));
  const target = new File(directory, safeName(name));
  if (target.exists && (target.size ?? 0) > 0) return target;
  directory.create({ intermediates: true, idempotent: true });
  return File.downloadFileAsync(url, target, { headers, idempotent: true });
}
