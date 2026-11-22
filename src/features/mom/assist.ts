import { rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';

const MODEL = 'ck.mom.document';

export type AssistPart = 'notes' | 'solusi' | 'tasks';

export type Job = { kind?: string; kindLabel?: string; state: string; label: string; message: string; note?: string };

const live = ['queued', 'running', 'retrying'];

export function isLive(job: Job | false | null | undefined): boolean {
  return !!job && live.includes(job.state);
}

export type NoteAttachment = { id: number; name: string; mimetype: string; size: number; state: string; stateLabel: string; waiting: boolean; error: string; chars: number; uploadedBy: string; uploadedAt: string };

export type ManualNotes = {
  meeting: string;
  note: { id: number; body: string; stamp: string; by: string; owner: string; inKnowledge: boolean } | false;
  attachments: NoteAttachment[];
  pending: boolean;
  canChange: boolean;
  maxFiles: number;
  maxBytes: number;
};

export function manualNotes(account: Account, meeting: number): Promise<ManualNotes> {
  return rpc(account, MODEL, 'manual_notes', [meeting]);
}

export function saveNote(account: Account, meeting: number, body: string, seen: string | null): Promise<ManualNotes> {
  return rpc(account, MODEL, 'save_manual_note', [meeting, body], { seen_stamp: seen });
}

export function attachToNote(account: Account, meeting: number, file: { name: string; mimetype: string; data: string }): Promise<ManualNotes> {
  return rpc(account, MODEL, 'attach_to_manual_note', [meeting, file.name, file.mimetype, file.data]);
}

export function readAttachmentAgain(account: Account, source: number): Promise<ManualNotes> {
  return rpc(account, MODEL, 'read_note_attachment_again', [source]);
}

export function removeAttachment(account: Account, source: number): Promise<ManualNotes> {
  return rpc(account, MODEL, 'remove_note_attachment', [source]);
}

export type SolusiItem = {
  id: number;
  sequence: number;
  need: string;
  title: string;
  approach: 'ODOO_STANDARD' | 'ODOO_CUSTOM' | 'NON_ODOO' | string;
  odooModules: string[];
  steps: string[];
  effort: string;
  notes: string;
  selectionReason: string;
  contextBasis: string[];
  customWithoutReason: boolean;
  touchpointTag: string;
  requirement: { id: number; ref: string; text: string } | false;
  approved: boolean;
  draftedBy: string;
  reusedFrom: string | false;
  scope: { verdict: string; label: string; rationale: string; confidence: number | false } | false;
  job: Job | false;
};

export type SolusiView = {
  id: number;
  version: number;
  current: boolean;
  overall: string;
  originLabel: string;
  originNote: string;
  model: string;
  by: string;
  at: string;
  itemCount: number;
  approvedCount: number;
  items?: SolusiItem[];
};

export type SolusiOverview = {
  meeting_id: number;
  meeting: string;
  generated: boolean;
  current: SolusiView | false;
  versions: SolusiView[];
  requirements: { id: number; ref: string; text: string }[];
  job: Job | false;
  canChange: boolean;
  canApprove: boolean;
  pendingDecisions: string[];
};

export function solusiOverview(account: Account, meeting: number): Promise<SolusiOverview> {
  return rpc(account, MODEL, 'solusi_overview', [meeting]);
}

export function solusiCall(account: Account, method: string, ...args: unknown[]): Promise<unknown> {
  return rpc(account, MODEL, method, args);
}

export function solusiVersion(account: Account, solusi: number): Promise<SolusiView> {
  return rpc(account, MODEL, 'solusi_version', [solusi]);
}

export type Related = SolusiItem & { meeting: string; meetingId?: number; department?: string; why?: string };

export function reuseCandidates(account: Account, item: number): Promise<{ candidates: Related[] }> {
  return rpc(account, MODEL, 'solusi_reuse_candidates', [item]);
}

export function touchpointConflicts(account: Account, item: number): Promise<{ tag: string; conflicts: Related[]; aligned: Related[]; truncated: boolean }> {
  return rpc(account, MODEL, 'solusi_touchpoint_conflicts', [item]);
}

const approaches = { ODOO_STANDARD: 'native', ODOO_CUSTOM: 'custom', NON_ODOO: 'non_odoo' } as const;

export type ItemDraft = { title: string; need: string; approach: string; modules: string; steps: string; effort: string; notes: string; reason: string; touchpoint: string; requirement: number | false };

export function draftOf(item: SolusiItem): ItemDraft {
  return {
    title: item.title,
    need: item.need,
    approach: item.approach,
    modules: item.odooModules.join(', '),
    steps: item.steps.join('\n'),
    effort: item.effort,
    notes: item.notes,
    reason: item.selectionReason,
    touchpoint: item.touchpointTag,
    requirement: item.requirement ? item.requirement.id : false,
  };
}

export function suggestionValues(draft: ItemDraft): Record<string, unknown> {
  const modules = draft.modules
    .split(',')
    .map((one) => one.trim())
    .filter(Boolean)
    .join(',');
  const steps = draft.steps
    .split('\n')
    .map((one) => one.trim())
    .filter(Boolean)
    .join('\n');
  return {
    name: draft.title.trim(),
    finding: draft.need.trim(),
    approach: approaches[draft.approach as keyof typeof approaches] ?? draft.approach,
    mom_modules: modules || false,
    mom_steps: steps || false,
    mom_effort: draft.effort || false,
    mom_notes: draft.notes.trim() || false,
    mom_selection_reason: draft.reason.trim() || false,
    mom_touchpoint: draft.touchpoint.trim() || false,
    requirement_id: draft.requirement,
  };
}

export function saveItem(account: Account, item: number, draft: ItemDraft): Promise<unknown> {
  return rpc(account, 'ck.odoo.suggestion', 'write', [[item], suggestionValues(draft)]);
}

export type DraftTask = {
  id: number;
  name: string;
  state: string;
  stateLabel: string;
  ownerId: number | false;
  owner: string;
  deadline: string | false;
  draftedBy: string;
  description: string;
  categoryLabel: string;
  solusiItem: string | false;
  duplicateOf: { id: number; name: string } | false;
  reason: string;
  quote: string;
  missing: string[];
  meetingSaid: { owner: string; due: string; differs: boolean } | false;
};

export type TasksOverview = { meeting: string; generated: boolean; tasks: DraftTask[]; people: { id: number; name: string }[]; approvedWaiting: number; job: Job | false; canChange: boolean; canAccept: boolean };

export function tasksOverview(account: Account, meeting: number): Promise<TasksOverview> {
  return rpc(account, MODEL, 'tasks_overview', [meeting]);
}

export function draftTasks(account: Account, meeting: number, from: 'solusi' | 'minutes'): Promise<TasksOverview> {
  return rpc(account, MODEL, from === 'solusi' ? 'draft_tasks_from_solusi' : 'draft_tasks_from_minutes', [meeting]);
}

export function setTask(account: Account, task: number, values: { owner_profile_id?: number | false; deadline?: string | false }): Promise<unknown> {
  return rpc(account, 'ck.meeting.action', 'write', [[task], values]);
}

export function acceptTask(account: Account, task: number): Promise<unknown> {
  return rpc(account, 'ck.meeting.action', 'action_accept_draft', [[task]]);
}

export function dropTask(account: Account, task: number): Promise<unknown> {
  return rpc(account, 'ck.meeting.action', 'unlink', [[task]]);
}
