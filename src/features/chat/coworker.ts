import { route, rpc } from '../../api/odoo';
import type { Card } from '../discovery/api';
import { run } from './messageActions';

export type Work = {
  turnId: number;
  messageId: number;
  channelId: number;
  state: string;
  agent: string;
  asker: string;
  askerUserId: number;
  step: string;
  detail: string;
  stoppedBy: string;
};

export type Wardmote = {
  turnId: number;
  answerId: number | null;
  state: string;
  agent: string;
  title: string;
  body: string;
  asker: string;
  canDecide: boolean;
  issue: string;
  url: string;
  status: string;
};

export type AgentCard = { packets: Card[]; wardmote: Wardmote | null; handedBy: string | null };

export type RecordCard = { kind: string; model: string; id: number; locked: boolean; title: string; status: string; key: string; parent: string; people: string[] };

const shownStates = new Set(['queued', 'running', 'away', 'stopped']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function workFrom(value: unknown): Work | null {
  if (!isRecord(value) || typeof value.turn_id !== 'number' || typeof value.message_id !== 'number') return null;
  return {
    turnId: value.turn_id,
    messageId: value.message_id,
    channelId: typeof value.channel_id === 'number' ? value.channel_id : 0,
    state: str(value.state),
    agent: str(value.agent),
    asker: str(value.asker),
    askerUserId: typeof value.asker_user_id === 'number' ? value.asker_user_id : 0,
    step: str(value.step),
    detail: str(value.step_detail),
    stoppedBy: str(value.stopped_by),
  };
}

export function isShownWork(work: Work): boolean {
  return shownStates.has(work.state);
}

export function workOf(channelId: number) {
  return run(async (account) => {
    const raw = await rpc<unknown[]>(account, 'kaitech.chat.turn', 'work_of', [channelId]);
    return (Array.isArray(raw) ? raw : []).map(workFrom).filter((work): work is Work => work !== null);
  });
}

export function stopWork(turnId: number) {
  return run(async (account) => rpc<string>(account, 'kaitech.chat.turn', 'stop_work', [turnId]));
}

function wardmoteFrom(value: unknown): Wardmote | null {
  if (!isRecord(value) || typeof value.turn_id !== 'number') return null;
  return {
    turnId: value.turn_id,
    answerId: typeof value.answer_id === 'number' ? value.answer_id : null,
    state: str(value.state),
    agent: str(value.agent),
    title: str(value.title),
    body: str(value.body),
    asker: str(value.asker),
    canDecide: value.can_decide === true,
    issue: str(value.issue),
    url: str(value.url),
    status: str(value.status),
  };
}

export function agentCardsFor(channelId: number, messageIds: number[]) {
  return run(async (account) => {
    const raw = await rpc<Record<string, unknown>>(account, 'kaitech.chat.turn', 'agent_cards', [channelId, messageIds]);
    const out = new Map<number, AgentCard>();
    for (const id of messageIds) {
      const card = isRecord(raw) ? raw[String(id)] : undefined;
      if (!isRecord(card)) {
        out.set(id, { packets: [], wardmote: null, handedBy: null });
        continue;
      }
      const handed = isRecord(card.handed) ? str(card.handed.by) || null : null;
      out.set(id, { packets: Array.isArray(card.packets) ? (card.packets as Card[]) : [], wardmote: wardmoteFrom(card.wardmote), handedBy: handed });
    }
    return out;
  });
}

export function decideWardmote(card: Wardmote, approve: boolean) {
  return run(async (account) => wardmoteFrom(await rpc<unknown>(account, 'kaitech.chat.turn', 'decide_wardmote', [card.turnId, approve, card.answerId ?? false])));
}

export function recordCards(urls: string[]) {
  return run(async (account) => {
    const raw = await route<Record<string, unknown>>(account, '/kaitech_chat/cards', { urls });
    const out = new Map<string, RecordCard>();
    for (const [url, value] of Object.entries(isRecord(raw) ? raw : {})) {
      if (!isRecord(value)) continue;
      out.set(url, {
        kind: str(value.kind),
        model: str(value.model),
        id: typeof value.id === 'number' ? value.id : 0,
        locked: value.locked === true,
        title: str(value.title),
        status: str(value.status),
        key: str(value.key),
        parent: str(value.parent),
        people: Array.isArray(value.people) ? value.people.filter((item): item is string => typeof item === 'string') : [],
      });
    }
    return out;
  });
}

export function linksIn(html: string, origin: string): string[] {
  const host = origin.replace(/^https?:\/\//, '');
  const out = new Set<string>();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1].replace(/&amp;/g, '&');
    if (/data-oe-model="res\.partner"/.test(match[0])) continue;
    const absolute = href.startsWith('/') ? `${origin}${href}` : href;
    if (absolute.includes(`//${host}/odoo/`) || absolute.includes(`//${host}/web#`) || absolute.includes(`//${host}/mail/view`)) out.add(absolute);
  }
  return [...out].slice(0, 5);
}
