import { rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';

export type MeetingRow = {
  id: number;
  name: string;
  day: string;
  programme: { id: number; name: string };
  recordings: number;
  transcribed: number;
  chip: string;
  chipLabel: string;
  generatedAt: string | false;
};

export type FinalRow = { documentId: number; meetingId: number; state: string; status: string };

export type Board = { meetings: (MeetingRow & { final?: FinalRow })[]; total: number };

export type UploadOptions = {
  now: string;
  zone: string;
  meetings: { id: number; name: string; held_on: string; signed: string | false; consent: boolean; recordings: number }[];
};

export type ActionItem = { task: string; owner?: string; due?: string; status?: string };

export type Summary = {
  summary?: string;
  ringkasan?: string;
  keputusan?: string[];
  action_items?: ActionItem[];
  risiko?: string[];
  blockers?: string[];
  follow_ups?: string[];
};

export type Item = {
  id: number;
  type: string;
  typeLabel: string;
  title: string;
  description: string;
  quote: string;
  at: string;
  speaker: string;
  status: string;
  statusLabel: string;
};

export type DetailRecording = { id: number; title: string; state: string; transcribed: boolean };

export type Detail = {
  closed?: boolean;
  meeting_id: number;
  meeting: string;
  programme: string;
  programmeId: number;
  day: string;
  chip: string;
  chipLabel: string;
  generated: boolean;
  recordings: DetailRecording[];
  summary: Summary;
  items: Item[];
};

export type Segment = { id: number; start: number; clock: string; speaker: string; text: string };

export type Profile = { profileId: number; name: string; role: string; organization: string; authority: boolean };

export type Point = { kode?: string; judul?: string; caraMengecek?: string[]; uraian?: string[]; status?: string };

export type FinalView = {
  documentId: number;
  meetingId: number;
  meeting: string;
  programme: string;
  programmeId: number;
  start: string | false;
  state: string;
  status: string;
  stages: { key: string; label: string }[];
  versionLabel: string;
  canChange: boolean;
  readiness: { generated: boolean; stale: boolean; generating: boolean; problems: string[] };
  paper: { documentTitle: string; meetingDate: string; points: Point[]; decisions: string[]; actionItems: ActionItem[] };
  signoff: boolean | string;
  signedBy: string;
  awaitingKnowledge: number;
  drift: boolean;
  profiles: Profile[];
};

const pageSize = 40;

export async function board(account: Account, limit = pageSize): Promise<Board> {
  const [minutes, finals] = await Promise.all([
    rpc<{ meetings: MeetingRow[]; total: number }>(account, 'ck.mom.document', 'minutes_board', [], { limit }),
    rpc<{ documents: FinalRow[] }>(account, 'ck.mom.document', 'final_board', [], { limit }),
  ]);
  const byMeeting = new Map(finals.documents.map((row) => [row.meetingId, row]));
  return {
    meetings: minutes.meetings.map((row) => ({ ...row, final: byMeeting.get(row.id) })),
    total: minutes.total,
  };
}

export function uploadOptions(account: Account, programme: number): Promise<UploadOptions> {
  return rpc<UploadOptions>(account, 'ck.mom.recording', 'upload_options', [programme]);
}

export function minutesDetail(account: Account, meeting: number): Promise<Detail> {
  return rpc<Detail>(account, 'ck.mom.document', 'minutes_detail', [meeting]);
}

export function finalMinutes(account: Account, programme: number, meeting: number): Promise<FinalView> {
  return rpc<FinalView>(account, 'ck.mom.document', 'final_minutes', [programme, meeting]);
}

export function signOff(account: Account, documentId: number, profile: number, role: string): Promise<FinalView> {
  return rpc<FinalView>(account, 'ck.mom.document', 'action_sign_off', [[documentId], profile, role]);
}

export function transcript(account: Account, recording: number): Promise<Segment[]> {
  return rpc<Segment[]>(account, 'ck.mom.recording', 'transcript', [[recording]]);
}

export function playbackUrl(account: Account, recording: number): Promise<string> {
  return rpc<string>(account, 'ck.mom.recording', 'playback_url', [[recording]], { audio: true });
}

export function secondsOf(clockText: string): number | null {
  const said = clockText.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(said)) return null;
  return said.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}
