import { rpc } from '../../api/odoo';
import { cachedTickets, dropTicket, storeTickets } from './db';
import { run } from './messageActions';

export type TicketState = 'draft' | 'progress' | 'blocked' | 'done' | 'cancelled';

export type Checkpoint = { id: number; seq: number; kind: string; body: string; actor: string; at: string };

export type Option = { id: number; label: string; recommended: boolean };

export type Question = {
  id: number;
  question: string;
  recommendation: string;
  options: Option[];
  state: string;
  messageId: number;
  answeredBy: string;
  answeredOption: number | null;
  canAnswer: boolean;
};

export type Ticket = {
  id: number;
  number: string;
  name: string;
  summary: string;
  state: TicketState;
  waitingOn: string;
  requester: string;
  requesterUserId: number;
  agent: string;
  programme: string;
  channelId: number;
  cardMessageId: number;
  openedAt: string;
  closedAt: string;
  result: string;
  checkpoints: Checkpoint[];
  question: Question | null;
  questions: Question[];
  answerers: string[];
  canDecide: boolean;
  canStop: boolean;
  canFollow: boolean;
  following: boolean;
  live: boolean;
  thread: string;
  linked: { id: number; number: string; name: string | null }[];
};

export type TicketRow = {
  id: number;
  number: string;
  name: string;
  state: TicketState;
  waitingOn: string;
  requester: string;
  thread: string;
  channelId: number;
  cardMessageId: number;
  last: string;
  updatedAt: string;
};

export type Scope = 'waiting' | 'mine' | 'threads' | 'all';

const states: TicketState[] = ['draft', 'progress', 'blocked', 'done', 'cancelled'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function stateOf(value: unknown): TicketState {
  return states.find((state) => state === value) ?? 'progress';
}

function checkpointFrom(value: unknown): Checkpoint | null {
  if (!isRecord(value) || typeof value.id !== 'number') return null;
  return { id: value.id, seq: num(value.seq), kind: str(value.kind), body: str(value.body), actor: str(value.actor), at: str(value.at) };
}

export function questionFrom(value: unknown): Question | null {
  if (!isRecord(value) || typeof value.id !== 'number') return null;
  const options = (Array.isArray(value.options) ? value.options : [])
    .filter(isRecord)
    .filter((option) => typeof option.id === 'number')
    .map((option) => ({ id: option.id as number, label: str(option.label), recommended: option.recommended === true }));
  return {
    id: value.id,
    question: str(value.question),
    recommendation: str(value.recommendation),
    options,
    state: str(value.state),
    messageId: num(value.message_id),
    answeredBy: str(value.answered_by),
    answeredOption: typeof value.answered_option === 'number' ? value.answered_option : null,
    canAnswer: value.can_answer === true,
  };
}

export function ticketFrom(value: unknown): Ticket | null {
  if (!isRecord(value) || typeof value.id !== 'number') return null;
  const checkpoints = (Array.isArray(value.checkpoints) ? value.checkpoints : []).map(checkpointFrom).filter((item): item is Checkpoint => item !== null);
  const questions = (Array.isArray(value.questions) ? value.questions : []).map(questionFrom).filter((item): item is Question => item !== null);
  const linked = (Array.isArray(value.linked) ? value.linked : [])
    .filter(isRecord)
    .map((item) => ({ id: num(item.id), number: str(item.number), name: typeof item.name === 'string' ? item.name : null }));
  return {
    id: value.id,
    number: str(value.number),
    name: str(value.name),
    summary: str(value.summary),
    state: stateOf(value.state),
    waitingOn: str(value.waiting_on),
    requester: str(value.requester),
    requesterUserId: num(value.requester_user_id),
    agent: str(value.agent),
    programme: str(value.programme),
    channelId: num(value.channel_id),
    cardMessageId: num(value.card_message_id),
    openedAt: str(value.opened_at),
    closedAt: str(value.closed_at),
    result: str(value.result),
    checkpoints: [...checkpoints].sort((a, b) => a.seq - b.seq),
    question: questionFrom(value.question),
    questions,
    answerers: Array.isArray(value.answerers) ? value.answerers.filter((item): item is string => typeof item === 'string') : [],
    canDecide: value.can_decide === true,
    canStop: value.can_stop === true,
    canFollow: value.can_follow === true,
    following: value.following === true,
    live: Array.isArray(value.live_turn_ids) && value.live_turn_ids.length > 0,
    thread: str(value.thread),
    linked,
  };
}

export function rowFrom(value: unknown): TicketRow | null {
  if (!isRecord(value) || typeof value.id !== 'number') return null;
  const last = isRecord(value.last_checkpoint) ? str(value.last_checkpoint.body) : '';
  return {
    id: value.id,
    number: str(value.number),
    name: str(value.name),
    state: stateOf(value.state),
    waitingOn: str(value.waiting_on),
    requester: str(value.requester),
    thread: str(value.thread),
    channelId: num(value.channel_id),
    cardMessageId: num(value.card_message_id),
    last,
    updatedAt: str(value.updated_at),
  };
}

export function lastSteps(ticket: Ticket, count = 3): Checkpoint[] {
  return ticket.checkpoints.slice(-count);
}

export function ticketDetail(ticketId: number) {
  return run(async (account) => {
    const ticket = ticketFrom(await rpc<unknown>(account, 'kaitech.chat.ticket', 'ticket_detail', [ticketId]));
    if (ticket) storeTickets(account.id, [ticket]);
    return ticket;
  });
}

export function answerQuestion(questionId: number, optionId: number) {
  return run(async (account) => ticketFrom(await rpc<unknown>(account, 'kaitech.chat.ticket', 'answer_question', [questionId, optionId])));
}

export function stopTicket(ticketId: number) {
  return run(async (account) => ticketFrom(await rpc<unknown>(account, 'kaitech.chat.ticket', 'stop_ticket', [ticketId])));
}

export function followTicket(ticketId: number, on: boolean) {
  return run(async (account) => ticketFrom(await rpc<unknown>(account, 'kaitech.chat.ticket', 'follow_ticket', [ticketId, on])));
}

export function ticketList(scope: Scope, after = 0) {
  return run(async (account) => {
    const raw = await rpc<unknown>(account, 'kaitech.chat.ticket', 'ticket_list', [scope, after]);
    const rows = isRecord(raw) && Array.isArray(raw.rows) ? raw.rows.map(rowFrom).filter((row): row is TicketRow => row !== null) : [];
    return { rows, next: isRecord(raw) && typeof raw.next === 'number' ? raw.next : null };
  });
}

export function offlineTicket(accountId: string, ticketId: number): Ticket | null {
  return cachedTickets<Ticket>(accountId).find((ticket) => ticket.id === ticketId) ?? null;
}

export type Reading = { ticket: Ticket } | { gone: true } | null;

export async function readTicket(accountId: string | null, ticketId: number): Promise<Reading> {
  const result = await ticketDetail(ticketId);
  if (result.ok) return result.value ? { ticket: result.value } : null;
  if (result.code === 'forbidden' || result.code === 'not_found') {
    if (accountId) dropTicket(accountId, ticketId);
    return { gone: true };
  }
  if (result.code !== 'network' || !accountId) return null;
  const cached = offlineTicket(accountId, ticketId);
  return cached ? { ticket: cached } : null;
}

type Notice = { ticketId: number; at: number };
const listeners = new Set<(notice: Notice) => void>();

export function onTicketNotice(listener: (notice: Notice) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function noticeTicket(payload: unknown) {
  const ticket = isRecord(payload) && isRecord(payload.ticket) ? payload.ticket : null;
  if (!ticket || typeof ticket.ticket_id !== 'number') return;
  const notice = { ticketId: ticket.ticket_id, at: Date.now() };
  listeners.forEach((listener) => listener(notice));
}
