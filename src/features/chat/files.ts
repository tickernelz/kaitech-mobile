import { Directory, File, Paths } from 'expo-file-system';
import { newKey } from './chat';

function outboxDirectory(): Directory {
  const directory = new Directory(Paths.document, 'chat-outbox');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function extension(name: string, mimetype: string): string {
  const fromName = /\.([a-z0-9]{1,8})$/i.exec(name)?.[1];
  if (fromName) return fromName.toLowerCase();
  const fromType = mimetype.split('/')[1]?.replace(/[^a-z0-9]/gi, '');
  return fromType ? fromType.slice(0, 8) : 'bin';
}

export function stageFile(uri: string, name: string, mimetype: string): { uri: string; size: number } {
  const source = new File(uri);
  const target = new File(outboxDirectory(), `${newKey()}.${extension(name, mimetype)}`);
  source.copy(target);
  return { uri: target.uri, size: target.size ?? 0 };
}

export function adoptFile(uri: string, mimetype: string): { uri: string; size: number } {
  const source = new File(uri);
  const target = new File(outboxDirectory(), `${newKey()}.${extension(source.name, mimetype)}`);
  source.move(target);
  return { uri: target.uri, size: target.size ?? 0 };
}

export function dropFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists && uri.includes('/chat-outbox/')) file.delete();
  } catch {
    return;
  }
}
