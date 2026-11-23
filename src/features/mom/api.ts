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
  decided?: boolean;
  module?: string;
  confidence?: number | false;
  reviewedBy?: string;
  reviewNote?: string;
  reason?: string;
  followUps?: { id: number; code: string; name: string; owner: string; due: string; suggested?: boolean }[];
  born?: { model: string; id: number; name: string } | false;
  finding?: { id: number; name: string } | false;
};

export type DetailRecording = { id: number; title: string; state: string; transcribed: boolean; unvalidated?: string[] };

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
  canChange?: boolean;
  isClient?: boolean;
  canDecide?: boolean;
  why_not?: string;
  job?: { state: string; label: string; message: string };
  minutes?: Record<string, unknown>;
  dynamics?: Record<string, unknown>;
  milestones?: Hint[];
  context?: Record<string, unknown>;
};

export type Hint = { id: number; task: string; planned_end: string | false; suggested_on: string | false; realized_on: string | false; quote: string; reason: string; state: string; status: string; decided_by: string };

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
  editable: boolean;
  isClient: boolean;
  readiness: { generated: boolean; stale: boolean; generating: boolean; problems: string[] };
  paper: { documentTitle: string; meetingDate: string; zone: string; points: Point[]; decisions: string[]; actionItems: ActionItem[] };
  signoff: boolean | string;
  signedBy: string;
  awaitingKnowledge: number;
  drift: boolean;
  profiles: Profile[];
  header: {
    meetingDate: string | false;
    location: string;
    topic: string;
    attendees: { profileId: number; name: string }[];
    noteTaker: string;
    noteTakerProfileId: number | false;
  };
  narrative: { text: string; at: string | false; model: string };
  sections: { key: string; label: string; items: FinalItem[] }[];
  edits: Edit[];
  outdated: { id: number; editId: number; section: string; sectionLabel: string; original_text: string; new_text: string }[];
  revokeReasons: string;
  distribution: Recipient[];
  distributionIsDefault: boolean;
  email: { subject: string; body: string; note: string; draftedAt: string | false; problems: string[] };
  teamNotes?: { title: string; content: string; sourceOwner: string; savedAt: string | false }[];
};

export type FinalItem = { section: string; index: number; base: string; text: string; edited: boolean; removed: boolean; lineId: number | false; agreed?: boolean };

export type EditLine = { id: number; section: string; sectionLabel: string; index: number; before: string; after: string; removed: boolean };

export type Edit = { id: number; mode: string; modeLabel: string; comment: string; state: string; stateLabel: string; proposedBy: string; lines: EditLine[]; placeholders: string[]; message?: string };

export type Recipient = {
  profileId: number;
  name: string;
  role: string;
  organization: string;
  address: string;
  sentAt: string | false;
  mailState: string;
  mailFailure: string;
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

export function removalPreview(account: Account, recording: number): Promise<{ withdrawn: string[]; held: string }> {
  return rpc<{ withdrawn: string[]; held: string }>(account, 'ck.mom.recording', 'removal_preview', [[recording]]);
}

export function removeRecording(account: Account, recording: number, title: string, password: string): Promise<{ ok: boolean; message?: string }> {
  return rpc<{ ok: boolean; message?: string }>(account, 'ck.mom.recording', 'remove_by_uploader', [[recording], title, password]);
}

export function secondsOf(clockText: string): number | null {
  const said = clockText.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(said)) return null;
  return said.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}
