import { Directory, File, Paths } from 'expo-file-system';
import { newKey } from './chat';
import { orphanStaging, relativeStaged, safeName, stagingFolder } from './cleanup';
import { fetchFile, forgetFiles } from './media/download';

function stagingDirectory(): Directory {
  const directory = new Directory(Paths.document, stagingFolder, newKey());
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

export function localFile(uri: string): File {
  return /^[a-z][a-z0-9+.-]*:/i.test(uri) ? new File(uri) : new File(Paths.document, uri);
}

function staged(target: File): { uri: string; size: number } {
  const file = new File(target.uri);
  return { uri: relativeStaged(Paths.document.uri, file.uri), size: file.size ?? 0 };
}

export async function stageFile(uri: string, name: string): Promise<{ uri: string; size: number }> {
  const target = new File(stagingDirectory(), safeName(name));
  await new File(uri).copy(target);
  return staged(target);
}

export async function adoptFile(uri: string, name: string): Promise<{ uri: string; size: number }> {
  const target = new File(stagingDirectory(), safeName(name));
  await new File(uri).move(target);
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

export function clearOpenedFiles(accountId: string) {
  forgetFiles(accountId);
}

export function downloadForOpening(
  key: { accountId: string; attachmentId: number; checksum: string | null },
  url: string,
  name: string,
  headers: Record<string, string>,
  fresh = false,
): Promise<File> {
  return fetchFile(key, url, name, headers, fresh);
}
