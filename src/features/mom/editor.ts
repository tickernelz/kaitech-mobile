import { rpc, sessionCookie } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import { downloadForOpening } from '../chat/files';

const RECORDING = 'ck.mom.recording';
const SEGMENT = 'ck.mom.segment';
const SPEAKER = 'ck.mom.speaker';

export type EditorSegment = {
  id: number;
  start: number;
  clock: string;
  speaker: string;
  person: string;
  text: string;
  transcribedText: string;
  corrected: boolean;
  speakerChanged: boolean;
  flagged: boolean;
  altText: string;
  verdict: string;
  verdictLabel: string;
  reason: string;
  doubts: number[];
};

export type EditorSpeaker = { id: number; label: string; profileId: number | false; person: string; validated: boolean; validatedBy: string; segments: number; seconds: number; first: number | false };

export type Doubt = { id: number; segmentId: number; clock: string; speaker: string; heard: string; meant: string; reason: string; confidence: number | false; source: string; fits: boolean };

export type Relabel = { id: number; said: string; scope: string; count: number; at: string; by: string; undone: boolean };

export type EditorView = {
  recording: { id: number; name: string };
  segments: EditorSegment[];
  speakers: EditorSpeaker[];
  doubts: Doubt[];
  people: { id: number; name: string; title: string }[];
  history: Relabel[];
  hasElevenLabs: boolean;
  check: { state: string; label: string; note: string; job?: { state: string } };
  canChange: boolean;
  settled: string;
};

export const segmentFilters = ['all', 'flagged', 'doubts', 'different', 'changed'] as const;
export type SegmentFilter = (typeof segmentFilters)[number];

export function matchesFilter(segment: EditorSegment, filter: SegmentFilter): boolean {
  if (filter === 'flagged') return segment.flagged;
  if (filter === 'doubts') return segment.doubts.length > 0;
  if (filter === 'different') return segment.verdict === 'divergent';
  if (filter === 'changed') return segment.corrected || segment.speakerChanged;
  return true;
}

export function visibleSegments(segments: EditorSegment[], filter: SegmentFilter, speaker: string, search: string): EditorSegment[] {
  const said = search.trim().toLowerCase();
  return segments.filter(
    (segment) =>
      matchesFilter(segment, filter) &&
      (!speaker || segment.speaker === speaker) &&
      (!said || `${segment.text} ${segment.speaker} ${segment.person}`.toLowerCase().includes(said)),
  );
}

export function segmentCounts(segments: EditorSegment[]): Record<SegmentFilter, number> {
  const counts: Record<SegmentFilter, number> = { all: 0, flagged: 0, doubts: 0, different: 0, changed: 0 };
  for (const segment of segments) for (const one of segmentFilters) if (matchesFilter(segment, one)) counts[one] += 1;
  return counts;
}

export function editor(account: Account, recording: number): Promise<EditorView> {
  return rpc(account, RECORDING, 'editor', [[recording]]);
}

export function correct(account: Account, segment: number, text: string): Promise<unknown> {
  return rpc(account, SEGMENT, 'action_correct', [[segment], text]);
}

export function restore(account: Account, segment: number): Promise<unknown> {
  return rpc(account, SEGMENT, 'action_restore_transcribed', [[segment]]);
}

export function takeElevenLabs(account: Account, segment: number): Promise<unknown> {
  return rpc(account, SEGMENT, 'action_use_elevenlabs', [[segment]]);
}

export function setFlag(account: Account, segment: number, flagged: boolean): Promise<unknown> {
  return rpc(account, SEGMENT, 'action_set_flag', [[segment], flagged]);
}

export type RelabelScope = 'segment' | 'from' | 'until';

export function relabel(account: Account, recording: number, segment: number, label: string, scope: RelabelScope): Promise<{ changed: number; relabel_id: number }> {
  return rpc(account, RECORDING, 'action_relabel', [[recording], segment, label.trim(), scope]);
}

export function undoRelabel(account: Account, relabelId: number): Promise<unknown> {
  return rpc(account, 'ck.mom.relabel', 'action_undo', [[relabelId]]);
}

export function mapSpeakers(account: Account, recording: number, mappings: { from: string; to: string }[]): Promise<unknown> {
  return rpc(account, RECORDING, 'action_map_speakers', [[recording], mappings]);
}

export function takeElevenLabsWhereDifferent(account: Account, recording: number): Promise<unknown> {
  return rpc(account, RECORDING, 'action_use_elevenlabs_where_different', [[recording]]);
}

export function findDoubts(account: Account, recording: number): Promise<unknown> {
  return rpc(account, RECORDING, 'find_doubtful_words', [[recording]]);
}

export function applyDoubts(account: Account, recording: number, ids: number[]): Promise<unknown> {
  return rpc(account, RECORDING, 'action_apply_doubts', [[recording], ids]);
}

export function settleDoubt(account: Account, doubt: number, apply: boolean): Promise<unknown> {
  return rpc(account, 'ck.mom.doubt', apply ? 'action_apply' : 'action_reject', [[doubt]]);
}

export function validateSpeaker(account: Account, speaker: number, valid: boolean): Promise<unknown> {
  return rpc(account, SPEAKER, valid ? 'action_validate' : 'action_unvalidate', [[speaker]]);
}

export function setSpeakerPerson(account: Account, speaker: number, profile: number | false): Promise<unknown> {
  return rpc(account, SPEAKER, 'action_set_person', [[speaker], profile]);
}

export function speakerMappings(current: string[], chosen: Record<string, string>): { from: string; to: string }[] {
  return current.filter((label) => (chosen[label] ?? label).trim() && (chosen[label] ?? label).trim() !== label).map((label) => ({ from: label, to: chosen[label].trim() }));
}

export async function openTranscriptFile(account: Account, recording: number, kind: 'txt' | 'docx', version: 'corrected' | 'elevenlabs') {
  const url = `${account.origin}/kaitech_mom/recording/${recording}/transcript?kind=${kind}&version=${version}`;
  const name = `transcript-${recording}-${version}.${kind}`;
  const file = await downloadForOpening({ accountId: account.id, attachmentId: recording, checksum: String(Date.now()) }, url, name, { Cookie: await sessionCookie(account) });
  return { file, name, mimeType: kind === 'txt' ? 'text/plain' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}
