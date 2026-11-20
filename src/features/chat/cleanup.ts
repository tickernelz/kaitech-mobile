import type { Pending } from './types';

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

export function orphanStaging(stagedFolders: string[], referencedUris: string[]): string[] {
  const kept = new Set(referencedUris.map((uri) => uri.replace(/\/[^/]*$/, '')));
  return stagedFolders.filter((folder) => !kept.has(folder.replace(/\/$/, '')));
}
