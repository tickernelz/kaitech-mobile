import { rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';

const UPDATE = 'ck.meeting.action.update';
const ACTION = 'ck.meeting.action';

export const followupStatuses = ['all', 'draft', 'open', 'late', 'done', 'archived'] as const;
export type FollowupStatus = (typeof followupStatuses)[number];

export const urgencies = ['critical', 'high', 'medium', 'low'] as const;
export type Urgency = (typeof urgencies)[number];

type Named = { id: number; name: string };

export type FollowupRow = {
  id: number;
  code: string;
  name: string;
  topic: string;
  detail: string;
  urgency: Urgency | '';
  urgencyLabel: string;
  owner: Named | false;
  ownerSaid: string;
  deadline: string;
  dueIn: number | null;
  status: string;
  statusLabel: string;
  progress: number;
  meeting: Named | false;
  archived: boolean;
  reported: boolean;
  draftedBy: string;
};

export type FollowupMeeting = {
  id: number;
  name: string;
  date: string;
  status: string;
  narrative: string;
  positives: string[];
  decisions: string[];
  help: string[];
  itemIds: number[];
};

export type FeedEntry = {
  id: number;
  percent: number | false;
  note: string;
  quote: string;
  originLabel: string;
  saidOn: string;
  meeting: Named | false;
  by: string;
  at: string;
  action: Named & { code: string };
};

export type FollowupBoard = {
  engagement: Named | false;
  items: FollowupRow[];
  page: { offset: number; limit: number; total: number };
  chips: Record<FollowupStatus, number>;
  attention: FollowupRow[];
  rollup: { id: number; name: string; total: number; done: number; late: number; open: number; average: number }[];
  meetings: FollowupMeeting[];
  feed: FeedEntry[];
  owners: Named[];
  meetingChoices: { id: number; name: string; date: string }[];
  scanning: number;
  kpi: { total: number; done: number; late: number; open: number; proposed: number; archived: number; completion: number; meetings7d: number };
};

export type HistoryEntry = { id: number; percent: number | false; note: string; quote: string; originLabel: string; saidOn: string; meeting: Named | false; by: string; at: string };

export type FollowupItem = FollowupRow & { history: HistoryEntry[]; minutes: Named; settledNote: string; reportedNote: string };

export type BoardQuery = { programme: number; status: FollowupStatus; owner: number; meeting: number; search: string; limit: number };

export function followupBoard(account: Account, query: BoardQuery): Promise<FollowupBoard> {
  return rpc<FollowupBoard>(account, UPDATE, 'followup_board', [], {
    engagement_id: query.programme,
    status: query.status,
    owner_id: query.owner,
    meeting_id: query.meeting,
    search: query.search,
    offset: 0,
    limit: query.limit,
  });
}

export function followupItem(account: Account, action: number): Promise<FollowupItem> {
  return rpc<FollowupItem>(account, UPDATE, 'followup_item', [action]);
}

export function recordProgress(account: Account, action: number, percent: number, note: string): Promise<unknown> {
  return rpc(account, UPDATE, 'record_progress', [action, percent], { note });
}

export function agree(account: Account, action: number): Promise<unknown> {
  return rpc(account, ACTION, 'action_accept_draft', [[action]]);
}

export function markDone(account: Account, action: number): Promise<unknown> {
  return rpc(account, ACTION, 'action_done', [[action]]);
}

export function archive(account: Account, action: number, archived: boolean): Promise<unknown> {
  return rpc(account, UPDATE, archived ? 'archive_followups' : 'restore_followups', [[action]]);
}

export function rescan(account: Account, programme: number): Promise<{ queued: number; meetings: number }> {
  return rpc(account, UPDATE, 'rescan_followups', [programme]);
}

export type Details = { owner: number | null; deadline: string; urgency: Urgency | ''; topic: string; detail: string };

export async function saveDetails(account: Account, item: FollowupRow, next: Details): Promise<void> {
  const ownerChanged = (next.owner ?? 0) !== (item.owner ? item.owner.id : 0);
  const deadlineChanged = next.deadline !== item.deadline;
  if (ownerChanged || deadlineChanged) {
    await rpc(account, ACTION, 'revise', [[item.id]], {
      ...(ownerChanged ? { owner_profile_id: next.owner || false } : {}),
      ...(deadlineChanged ? { deadline: next.deadline || false } : {}),
    });
  }
  await rpc(account, UPDATE, 'set_followup_details', [item.id], { urgency: next.urgency, topic: next.topic, detail: next.detail });
}

export async function raiseFollowup(
  account: Account,
  draft: { meeting: number; name: string; owner: number; deadline: string; urgency: Urgency | ''; detail: string },
): Promise<number> {
  const raised = await rpc<{ action_id: number }>(account, 'ck.meeting', 'raise_action', [[draft.meeting], draft.name.trim(), draft.owner, draft.deadline]);
  if (draft.urgency || draft.detail.trim()) {
    await rpc(account, UPDATE, 'set_followup_details', [raised.action_id], { urgency: draft.urgency, detail: draft.detail.trim() });
  }
  return raised.action_id;
}

export function isDay(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const at = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return at.getFullYear() === Number(match[1]) && at.getMonth() === Number(match[2]) - 1 && at.getDate() === Number(match[3]);
}

export function dayFrom(offset: number, from = new Date()): string {
  const at = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

export function canWork(row: Pick<FollowupRow, 'status' | 'archived'>): boolean {
  return !row.archived && ['draft', 'open', 'late'].includes(row.status);
}
