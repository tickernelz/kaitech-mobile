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

export type AgentCard = { packets: Card[]; wardmote: Wardmote | null; handedBy: string | null; said: string };

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
        out.set(id, { packets: [], wardmote: null, handedBy: null, said: '' });
        continue;
      }
      const handed = isRecord(card.handed) ? str(card.handed.by) || null : null;
      out.set(id, { packets: Array.isArray(card.packets) ? (card.packets as Card[]) : [], wardmote: wardmoteFrom(card.wardmote), handedBy: handed, said: str(card.said) });
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

const messageLinks = new WeakMap<object, string[]>();

export function linksOfMessage(message: { body: string }, origin: string): string[] {
  const known = messageLinks.get(message);
  if (known) return known;
  const urls = linksIn(message.body, origin);
  messageLinks.set(message, urls);
  return urls;
}

export function linksIn(html: string, origin: string): string[] {
  const host = origin.replace(/^https?:\/\//, '');
  const out = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*>/g)) {
    const tag = match[0];
    const found = /href="([^"]+)"/.exec(tag);
    if (!found || /data-oe-model="res\.partner"/.test(tag)) continue;
    const href = found[1].replace(/&amp;/g, '&');
    const absolute = href.startsWith('/') ? `${origin}${href}` : href;
    if (absolute.includes(`//${host}/odoo/`) || absolute.includes(`//${host}/web#`) || absolute.includes(`//${host}/mail/view`)) out.add(absolute);
  }
  return [...out].slice(0, 5);
}

export type CardStore<K, V> = {
  get: (key: K) => V | undefined;
  version: (keys: readonly K[]) => number;
  subscribe: (keys: readonly K[], listener: () => void) => () => void;
  want: (keys: readonly K[]) => void;
  put: (key: K, value: V) => void;
  dispose: () => void;
};

export function createCardStore<K, V>(load: (keys: K[]) => Promise<Map<K, V> | null>, delayMs = 120): CardStore<K, V> {
  const found = new Map<K, V>();
  const versions = new Map<K, number>();
  const listeners = new Map<K, Set<() => void>>();
  const asked = new Set<K>();
  const waiting = new Set<K>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const put = (key: K, value: V) => {
    found.set(key, value);
    versions.set(key, (versions.get(key) ?? 0) + 1);
    listeners.get(key)?.forEach((listener) => listener());
  };
  return {
    get: (key) => found.get(key),
    version: (keys) => keys.reduce((sum, key) => sum + (versions.get(key) ?? 0), 0),
    subscribe(keys, listener) {
      for (const key of keys) {
        const set = listeners.get(key) ?? new Set();
        set.add(listener);
        listeners.set(key, set);
      }
      return () => {
        for (const key of keys) {
          const set = listeners.get(key);
          set?.delete(listener);
          if (set && !set.size) listeners.delete(key);
        }
      };
    },
    want(keys) {
      for (const key of keys) {
        if (asked.has(key)) continue;
        asked.add(key);
        waiting.add(key);
      }
      if (!waiting.size || timer) return;
      timer = setTimeout(() => {
        timer = null;
        const batch = [...waiting];
        waiting.clear();
        void load(batch).then((result) => {
          if (!result) {
            batch.forEach((key) => asked.delete(key));
            return;
          }
          for (const [key, value] of result) put(key, value);
        });
      }, delayMs);
    },
    put,
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
