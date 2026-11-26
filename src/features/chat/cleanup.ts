import type { Pending } from './types';

export const stagingFolder = 'chat-outbox';

export async function forgetChatAccount(
  accountId: string,
  deps: {
    pendingFor: (accountId: string) => Pending[];
    dropFile: (uri: string) => void;
    forgetDrafts: (accountId: string) => void;
    forgetAccount: (accountId: string) => Promise<void>;
  },
) {
  for (const item of deps.pendingFor(accountId)) item.files.forEach((file) => deps.dropFile(file.uri));
  deps.forgetDrafts(accountId);
  await deps.forgetAccount(accountId);
}

export function stagingName(uri: string): string | null {
  const match = new RegExp(`(?:^|/)${stagingFolder}/([^/]+)/[^/]+$`).exec(uri);
  return match ? match[1] : null;
}

export function orphanStaging(folderNames: string[], referencedUris: string[]): string[] {
  const kept = new Set(referencedUris.map(stagingName).filter((name): name is string => name !== null));
  return folderNames.filter((name) => !kept.has(name));
}

export function relativeStaged(documentUri: string, uri: string): string {
  const base = documentUri.endsWith('/') ? documentUri : `${documentUri}/`;
  return uri.startsWith(base) ? uri.slice(base.length) : uri;
}

export function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(-120) || 'file';
}

export function accountFolderName(accountId: string): string {
  return accountId.replace(/[^\w-]/g, '_');
}

export function attachmentFolderName(attachmentId: number, checksum: string | null): string {
  return `${attachmentId}-${(checksum ?? 'none').replace(/[^\w-]/g, '_')}`;
}

export function openedFolderName(accountId: string, attachmentId: number, checksum: string | null): string {
  return `${accountFolderName(accountId)}/${attachmentFolderName(attachmentId, checksum)}`;
}
