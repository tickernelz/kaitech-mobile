import { rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import type { Edit, FinalView } from './api';

const MODEL = 'ck.mom.document';

export type FinalTool = 'content' | 'rewrite' | 'header' | 'recipients' | 'email' | 'narrative' | 'context' | 'revoke';

export type NextStep = 'sign' | 'finalize' | 'distribute' | 'distributeRest' | null;

export function nextStep(view: FinalView): NextStep {
  if (!view.canChange) return null;
  const reachable = view.distribution.some((one) => one.address && !one.sentAt);
  if (view.state === 'draft') return 'sign';
  if (view.state === 'reviewed') return 'finalize';
  if (view.state === 'final') return 'distribute';
  if (view.state === 'distributed' && reachable) return 'distributeRest';
  return null;
}

export type StepBlocker = 'problems' | 'drift' | 'noEmail' | 'emailProblems' | 'noRecipient';

export function stepBlocker(view: FinalView, step: NextStep): StepBlocker | null {
  if (step === 'finalize') {
    if (view.readiness.problems.length) return 'problems';
    if (view.drift) return 'drift';
  }
  if (step === 'distribute' || step === 'distributeRest') {
    if (!view.email.subject.trim() || !view.email.body.trim()) return 'noEmail';
    if (view.email.problems.length) return 'emailProblems';
    if (!view.distribution.some((one) => one.address && !one.sentAt)) return 'noRecipient';
  }
  return null;
}

export function finalize(account: Account, document: number): Promise<FinalView> {
  return rpc(account, MODEL, 'action_finalize', [[document]]);
}

export function distribute(account: Account, document: number): Promise<FinalView> {
  return rpc(account, MODEL, 'action_distribute', [[document]]);
}

export function revokeSignoff(account: Account, document: number, reason: string): Promise<FinalView> {
  return rpc(account, MODEL, 'action_revoke_signoff', [[document], reason.trim()]);
}

export function previewRewrite(account: Account, meeting: number, section: string, index: number, change: { comment?: string; text?: string }): Promise<Edit> {
  return rpc(account, MODEL, 'preview_rewrite', [false, meeting, section, index], change);
}

export function previewBulk(account: Account, meeting: number, guidance: string): Promise<Edit> {
  return rpc(account, MODEL, 'preview_bulk_rewrite', [false, meeting, guidance.trim()], { mode: 'auto' });
}

export function settleEdit(account: Account, edit: number, apply: boolean): Promise<Edit> {
  return rpc(account, 'ck.mom.edit', apply ? 'action_apply' : 'action_discard', [[edit]]);
}

export type Header = { meetingDate: string; location: string; topic: string; noteTaker: number | null; attendees: number[] };

export function setHeader(account: Account, document: number, header: Header): Promise<FinalView> {
  return rpc(account, MODEL, 'action_set_header', [[document]], {
    meeting_date: header.meetingDate,
    location: header.location,
    topic: header.topic,
    note_taker_profile_id: header.noteTaker || false,
    attendee_profile_ids: header.attendees,
  });
}

export function setDistribution(account: Account, document: number, profiles: number[]): Promise<FinalView> {
  return rpc(account, MODEL, 'action_set_distribution', [[document], profiles]);
}

export function draftEmail(account: Account, meeting: number, note: string): Promise<{ subject: string; body: string }> {
  return rpc(account, MODEL, 'draft_email', [false, meeting], { extra_note: note.trim() });
}

export function saveEmail(account: Account, document: number, subject: string, body: string): Promise<FinalView> {
  return rpc(account, MODEL, 'save_email', [[document], subject, body]);
}

export function regenerateNarrative(account: Account, meeting: number): Promise<{ narrative: string; model: string }> {
  return rpc(account, MODEL, 'regenerate_narrative', [false, meeting]);
}

export function saveNarrative(account: Account, document: number, text: string): Promise<FinalView> {
  return rpc(account, MODEL, 'save_narrative', [[document], text]);
}

type Brief = { id: number; title: string; owner?: string; status?: string; meeting?: string; code?: string; due?: string; start?: string | false };

export type MeetingContext = {
  counts: Record<'openActions' | 'openQuestions' | 'pendingDecisions' | 'approvedDecisions' | 'recentNotes' | 'previousMeetings', number>;
  openActions: Brief[];
  openQuestions: Brief[];
  pendingDecisions: Brief[];
  approvedDecisions: Brief[];
  recentNotes: Brief[];
  previousMeetings: Brief[];
  carriedActions: Brief[];
  prerequisites: string;
};

export function meetingContext(account: Account, meeting: number): Promise<MeetingContext> {
  return rpc(account, MODEL, 'pre_meeting_context', [false, meeting]);
}

export type ExportFile = { name: string; format: string; url: string; attachmentId: number };

export function exportMinutes(account: Account, meeting: number, format: 'docx' | 'pdf', complete: boolean): Promise<ExportFile> {
  return rpc(account, MODEL, 'export_minutes', [false, meeting], { file_format: format, complete });
}

export function localMoment(stamp: string | false, zone: string): string {
  if (!stamp) return '';
  const moment = new Date(stamp);
  if (Number.isNaN(moment.getTime())) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: zone || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(moment)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function isMoment(text: string): boolean {
  return /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(text.trim());
}
