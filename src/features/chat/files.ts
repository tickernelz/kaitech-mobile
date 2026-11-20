import { Directory, File, Paths } from 'expo-file-system';
import { newKey } from './chat';

const folder = 'chat-outbox';

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
