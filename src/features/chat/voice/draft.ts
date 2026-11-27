import { Directory, File, Paths } from 'expo-file-system';
import { onAccountForgotten } from '../../../auth/session';

export const draftRoot = 'chat-voice-draft';
const draftName = 'draft.json';

export type VoiceDraft = { parts: string[]; durationMs: number; levels: number[] };

function accountFolder(accountId: string): Directory {
  return new Directory(Paths.document, draftRoot, encodeURIComponent(accountId));
}

export function draftFolder(accountId: string, channelId: number): Directory {
  const folder = new Directory(accountFolder(accountId), String(channelId));
  folder.create({ intermediates: true, idempotent: true });
  return folder;
}

export function partFile(accountId: string, channelId: number, name: string): File {
  return new File(draftFolder(accountId, channelId), name);
}

export function readVoiceDraft(accountId: string, channelId: number): VoiceDraft | null {
  try {
    const folder = new Directory(accountFolder(accountId), String(channelId));
    const file = new File(folder, draftName);
    if (!file.exists) return null;
    const raw = JSON.parse(file.textSync()) as Partial<VoiceDraft>;
    const parts = Array.isArray(raw.parts) ? raw.parts.filter((name): name is string => typeof name === 'string') : [];
    if (!parts.length || !parts.every((name) => new File(folder, name).exists)) return null;
    const levels = Array.isArray(raw.levels) ? raw.levels.filter((level): level is number => typeof level === 'number') : [];
    return { parts, durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : 0, levels };
  } catch {
    return null;
  }
}

export function writeVoiceDraft(accountId: string, channelId: number, draft: VoiceDraft) {
  const file = new File(draftFolder(accountId, channelId), draftName);
  if (!file.exists) file.create();
  file.write(JSON.stringify(draft));
}

export function dropVoiceDraft(accountId: string, channelId: number) {
  try {
    const folder = new Directory(accountFolder(accountId), String(channelId));
    if (folder.exists) folder.delete();
  } catch {
    return;
  }
}

onAccountForgotten((accountId) => {
  try {
    const folder = accountFolder(accountId);
    if (folder.exists) folder.delete();
  } catch {
    return;
  }
});
