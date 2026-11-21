import { bearer, bearerUpload, rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import type { BlockReads } from './kt/place';

export type Programme = {
  id: number;
  name: string;
  client: string;
  state: string;
  state_label: string;
  waiting: number;
  last_activity_at: string | false;
};

export type PanelPacket = { id: number; name: string; conversation_id: number; kind: string; state: string; state_label: string };
export type AgendaLine = { kind: string; headline: string; count: number };

export type Panel = {
  id: number;
  name: string;
  client: string;
  state: string;
  state_label: string;
  progress: {
    question_total: number;
    question_answered: number;
    question_unreviewed: number;
    gates_total: number;
    gates_signed: number;
  };
  packets: PanelPacket[];
  needs_you: AgendaLine[];
  coworker: AgendaLine[];
  sources: number;
};

export type Counts = { evidence: number; findings: number };

export type Attachment = { id: number; attachmentId?: number; name: string; mimetype: string; size?: number; sizeLabel: string };

export type Document = { name: string; mimetype: string; data: string };

export type Failure = { said: string; help: string; final: boolean; retry: boolean };

export type TranscriptItem = {
  turnId: number;
  seq: number;
  kind: string;
  author: string;
  name: string;
  body: string;
  intention?: string;
  attachments?: Attachment[];
  failure?: Failure;
  state?: string;
  occurredAt: string;
  blockReads?: BlockReads | null;
};

export type Cursor = { turn_id: number; seq: number; open: Record<string, number> };

export type Transcript = {
  conversation_id: number;
  title: string;
  items: TranscriptItem[];
  cursor: Cursor;
  state: string;
  running: boolean;
  following: boolean;
  working: boolean;
  pending_question: string;
};

export type Conversation = { id: number; name: string; last_activity_at: string | false };

export type CardItem = {
  id: number;
  name: string;
  doubtful: boolean;
  doubt: string;
  outcome: 'pending' | 'accepted' | 'held' | string;
  held_because: string;
  arguments: { name: string; label: string; value: string }[];
  landings: string[];
};

export type Instruction = {
  id: number;
  sentence: string;
  restatement: string;
  state: string;
  said_by: string;
  answer: string;
  yours?: boolean;
};

export type Card = {
  id: number;
  title: string;
  why: string;
  stage: string;
  kind: string;
  state: string;
  settled: boolean;
  decided_by: string;
  decided_by_you: boolean;
  withdrawn: boolean;
  item_count: number;
  doubtful_count: number;
  items: CardItem[];
  instruction: Instruction | null;
};

export type Relation = [number, string] | false;

export type Evidence = {
  id: number;
  quote: string;
  source_kind: string;
  stated_by_profile_id: Relation;
  stated_at: string | false;
  source_text_id: Relation;
  question_ids: number[];
  conflict: boolean;
};

export type Finding = {
  id: number;
  ck_id: string;
  name: string;
  kind: string;
  body: string;
  state: string;
  confidence: string;
  topic: string | false;
  question_id: Relation;
  side_ids: number[];
};

export type FindingSide = {
  id: number;
  quote: string;
  source_kind: string;
  stated_by: string | false;
  stated_at: string | false;
  source_text_id: Relation;
  live: boolean;
};

export type BriefingItem = {
  kind: string;
  engagement_id: number;
  engagement: string;
  headline: string;
  count: number;
  since: string;
  packet_id?: number;
  conversation_id?: number;
};

export type SearchHits = {
  chat: { message_id: number; channel_id: number; channel_name: string; author: string; text: string; date: string }[];
  discovery: { kind: 'programme' | 'conversation' | 'card'; id: number; title: string; engagement_id: number }[];
  mom: { kind: 'recording' | 'minutes'; id: number; title: string; engagement_id: number; meeting_id: number }[];
};

export type EvidenceKind = 'all' | 'interview' | 'document' | 'meeting' | 'other';

export const evidencePage = 30;
const otherKinds = ['consultant', 'legacy', 'prototype'];

export function programmes(account: Account) {
  return rpc<Programme[]>(account, 'ck.engagement', 'chat_contexts');
}

export function panel(account: Account, programme: number) {
  return rpc<Panel>(account, 'ck.engagement', 'programme_panel', [[programme]]);
}

export async function counts(account: Account, programme: number): Promise<Counts> {
  const [evidence, findings] = await Promise.all([
    rpc<number>(account, 'ck.evidence', 'search_count', [[['engagement_id', '=', programme], ['live', '=', true]]]),
    rpc<number>(account, 'ck.finding', 'search_count', [[['engagement_id', '=', programme], ['state', '!=', 'dismissed']]]),
  ]);
  return { evidence, findings };
}

export function conversations(account: Account, programme: number) {
  return rpc<Conversation[]>(account, 'ck.conversation', 'search_read', [[['engagement_id', '=', programme]]], {
    fields: ['name', 'last_activity_at'],
    order: 'last_activity_at desc, id desc',
    limit: 30,
  });
}

export function transcript(account: Account, conversation: number, cursor?: Cursor) {
  return rpc<Transcript>(account, 'ck.conversation', 'fetch_transcript', [[conversation]], {
    after_turn_id: cursor?.turn_id ?? 0,
    after_seq: cursor?.seq ?? 0,
    open_turns: cursor?.open ?? {},
  });
}

type Asked = { conversation_id: number; turn_id: number; replayed: boolean };

export function ask(
  account: Account,
  question: { key: string; request: string; conversationId?: number; programme: number; documents?: Document[] },
  onProgress?: (fraction: number) => void,
) {
  const body = {
    key: question.key,
    request: question.request,
    ...(question.conversationId ? { conversation_id: question.conversationId } : { engagement_id: question.programme }),
    ...(question.documents?.length ? { documents: question.documents } : {}),
  };
  if (question.documents?.length && onProgress) return bearerUpload<Asked>(account, '/kaitech_mobile/discovery/ask', body, onProgress);
  return bearer<Asked>(account, '/kaitech_mobile/discovery/ask', { method: 'POST', body });
}

export function cards(account: Account, ids: number[]) {
  return ids.length ? rpc<Card[]>(account, 'ck.approval.packet', 'read_packets', [ids]) : Promise.resolve([]);
}

export function openCards(account: Account, programme: number) {
  return rpc<Card[]>(account, 'ck.approval.packet', 'read_open_packets', [programme]);
}

export async function card(account: Account, id: number) {
  return (await bearer<{ packet: Card }>(account, '/kaitech_mobile/discovery/card', { query: { packet_id: id } })).packet;
}

export async function answer(account: Account, instruction: number, agree: boolean) {
  return (
    await bearer<{ packet: Card }>(account, '/kaitech_mobile/discovery/answer', {
      method: 'POST',
      body: { instruction_id: instruction, agree },
    })
  ).packet;
}

function evidenceDomain(programme: number, kind: EvidenceKind): unknown[] {
  const domain: unknown[] = [['engagement_id', '=', programme], ['live', '=', true]];
  if (kind === 'other') domain.push(['source_kind', 'in', otherKinds]);
  else if (kind !== 'all') domain.push(['source_kind', '=', kind]);
  return domain;
}

export async function evidence(account: Account, programme: number, kind: EvidenceKind, offset = 0): Promise<Evidence[]> {
  const rows = await rpc<Omit<Evidence, 'conflict'>[]>(account, 'ck.evidence', 'search_read', [evidenceDomain(programme, kind)], {
    fields: ['quote', 'source_kind', 'stated_by_profile_id', 'stated_at', 'source_text_id', 'question_ids'],
    order: 'id desc',
    limit: evidencePage,
    offset,
  });
  if (!rows.length) return [];
  const clashing = await rpc<{ evidence_id: Relation }[]>(account, 'ck.finding.side', 'search_read', [
    [['evidence_id', 'in', rows.map((row) => row.id)], ['finding_id.kind', '=', 'conflict'], ['finding_id.state', '!=', 'dismissed']],
  ], { fields: ['evidence_id'] });
  const conflict = new Set(clashing.map((side) => (side.evidence_id ? side.evidence_id[0] : 0)));
  return rows.map((row) => ({ ...row, conflict: conflict.has(row.id) }));
}

export function findings(account: Account, programme: number) {
  return rpc<Finding[]>(account, 'ck.finding', 'search_read', [[['engagement_id', '=', programme], ['state', '!=', 'dismissed']]], {
    fields: ['ck_id', 'name', 'kind', 'body', 'state', 'confidence', 'topic', 'question_id', 'side_ids'],
    order: 'id desc',
    limit: 50,
  });
}

export async function finding(account: Account, id: number): Promise<{ finding: Finding; sides: FindingSide[] }> {
  const [found] = await rpc<Finding[]>(account, 'ck.finding', 'read', [[id]], {
    fields: ['ck_id', 'name', 'kind', 'body', 'state', 'confidence', 'topic', 'question_id', 'side_ids'],
  });
  const sides = await rpc<FindingSide[]>(account, 'ck.finding.side', 'search_read', [[['finding_id', '=', id]]], {
    fields: ['quote', 'source_kind', 'stated_by', 'stated_at', 'source_text_id', 'live'],
  });
  return { finding: found, sides };
}

export async function briefing(account: Account) {
  return (await rpc<{ items: BriefingItem[] }>(account, 'ck.engagement', 'briefing_for_me')).items;
}

export function search(account: Account, q: string) {
  return bearer<SearchHits>(account, '/kaitech_mobile/search', { query: { q, limit: 10 } });
}
