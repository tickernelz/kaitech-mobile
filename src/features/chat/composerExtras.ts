import { route, rpc } from '../../api/odoo';
import { chatClient, newKey } from './chat';
import { composeBody, mentionsInText } from './html';
import { run, odooDatetime } from './messageActions';
import { gifFrom, stickerFrom } from './rich';
import type { GifMedia, Mention, PendingFile, Sticker } from './types';

export function cannedQuery(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf('::');
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]))) return null;
  const query = before.slice(at + 2);
  if (/\s/.test(query) || query.length > 32) return null;
  return { start: at, query };
}

const zeroWidthJoiner = 0x200d;

function attaches(point: number): boolean {
  return point === 0xfe0f || point === 0xfe0e || point === 0x20e3 || (point >= 0x1f3fb && point <= 0x1f3ff) || (point >= 0xe0020 && point <= 0xe007f);
}

function regional(point: number): boolean {
  return point >= 0x1f1e6 && point <= 0x1f1ff;
}

export function deleteBefore(text: string, cursor: number): { text: string; cursor: number } {
  const head = Array.from(text.slice(0, cursor));
  if (!head.length) return { text, cursor };
  const point = (index: number) => head[index].codePointAt(0) ?? 0;
  let start = head.length - 1;
  while (start > 0 && attaches(point(start))) start -= 1;
  while (start > 1 && point(start - 1) === zeroWidthJoiner) {
    start -= 2;
    while (start > 0 && attaches(point(start))) start -= 1;
  }
  if (regional(point(start))) {
    let run = 0;
    for (let index = start; index >= 0 && regional(point(index)); index -= 1) run += 1;
    if (run % 2 === 0) start -= 1;
  }
  const kept = head.slice(0, start).join('');
  return { text: kept + text.slice(cursor), cursor: kept.length };
}

export type Canned = { id: number; source: string; substitution: string };

export function cannedResponses(query: string) {
  return run(async (account): Promise<Canned[]> => {
    const rows = await rpc<{ id: number; source: string; substitution: string }[]>(account, 'mail.canned.response', 'search_read', [query ? [['source', 'ilike', query]] : []], {
      fields: ['source', 'substitution'],
      limit: 8,
      order: 'last_used desc, id desc',
    });
    return (rows ?? []).map((row) => ({ id: row.id, source: row.source ?? '', substitution: row.substitution ?? '' }));
  });
}

export function markCannedUsed(id: number) {
  return run(async (account) => {
    await rpc(account, 'mail.canned.response', 'write', [[id], { last_used: odooDatetime(Date.now()) }]);
  });
}

export type Attribution = { placeholder: string; mark: string };
export type Page<T> = { items: T[]; next: string | null; attribution: Attribution | null };
export type StickerPack = { id: number; name: string; stickers: Sticker[] };
export type StickerShelf = { packs: StickerPack[]; recent: Sticker[]; favorites: number[] };

type RawPage = { results?: unknown[]; next?: unknown; attribution?: { placeholder?: unknown; mark?: unknown } };

function attributionOf(raw: RawPage | null): Attribution | null {
  const value = raw?.attribution;
  if (!value || typeof value.mark !== 'string') return null;
  return { placeholder: typeof value.placeholder === 'string' ? value.placeholder : '', mark: value.mark };
}

export function pageOf<T>(raw: RawPage | null, parse: (item: unknown) => T | null): Page<T> {
  const items: T[] = [];
  for (const item of raw?.results ?? []) {
    const parsed = parse(item);
    if (parsed) items.push(parsed);
  }
  return { items, next: typeof raw?.next === 'string' && raw.next ? raw.next : null, attribution: attributionOf(raw) };
}

export function gifPage(query: string, position: string | null) {
  const term = query.trim();
  return run(async (account): Promise<Page<GifMedia>> => {
    const raw = await route<RawPage>(account, term ? '/kaitech_chat/gif/search' : '/kaitech_chat/gif/trending', { ...(term ? { query: term } : {}), ...(position ? { position } : {}) });
    return pageOf(raw, gifFrom);
  });
}

export function providerStickerPage(query: string, position: string | null) {
  const term = query.trim();
  return run(async (account): Promise<Page<Sticker>> => {
    const raw = await route<RawPage>(account, '/kaitech_chat/gif/stickers', { ...(term ? { query: term } : {}), ...(position ? { position } : {}) });
    return pageOf(raw, stickerFrom);
  });
}

export function stickerShelf() {
  return run(async (account): Promise<StickerShelf> => shelfOf(await route<{ packs?: unknown[]; recent?: unknown[]; favorites?: unknown[] }>(account, '/kaitech_chat/stickers', {})));
}

export function shelfOf(raw: { packs?: unknown[]; recent?: unknown[]; favorites?: unknown[] } | null): StickerShelf {
  const byId = new Map<number, Sticker>();
  const packs: StickerPack[] = [];
  for (const item of raw?.packs ?? []) {
    if (!item || typeof item !== 'object') continue;
    const pack = item as { id?: unknown; name?: unknown; stickers?: unknown[] };
    if (typeof pack.id !== 'number') continue;
    const stickers = (pack.stickers ?? []).map(stickerFrom).filter((sticker): sticker is Sticker => sticker !== null && sticker.source === 'pack');
    stickers.forEach((sticker) => byId.set(sticker.id as number, sticker));
    if (stickers.length) packs.push({ id: pack.id, name: typeof pack.name === 'string' ? pack.name : '', stickers });
  }
  const numbers = (list: unknown[] | undefined) => (list ?? []).filter((value): value is number => typeof value === 'number');
  const recent = numbers(raw?.recent)
    .map((stickerId) => byId.get(stickerId))
    .filter((sticker): sticker is Sticker => sticker !== undefined);
  return { packs, recent, favorites: numbers(raw?.favorites) };
}

export function sendLater(input: { channelId: number; text: string; mentions: Mention[]; files: Omit<PendingFile, 'key' | 'attachmentId' | 'ownershipToken'>[]; when: number }) {
  return run(async (account) => {
    const client = chatClient();
    if (!client) throw new Error('signedOut');
    const uploaded = [];
    for (const file of input.files) uploaded.push(await client.upload(input.channelId, { ...file, key: newKey(), attachmentId: null, ownershipToken: null }));
    const used = mentionsInText(input.text, input.mentions);
    await rpc(account, 'discuss.channel', 'kaitech_chat_send_later', [
      [input.channelId],
      {
        body: composeBody(input.text, used),
        partner_ids: used.map((mention) => mention.id),
        attachment_ids: uploaded.map((file) => file.attachmentId),
        attachment_tokens: uploaded.map((file) => file.ownershipToken),
      },
      odooDatetime(input.when),
    ]);
  });
}

export function quickTimes(now: number): { key: 'tomorrow' | 'monday'; when: number }[] {
  const morning = (date: Date) => {
    date.setHours(8, 0, 0, 0);
    return date.getTime();
  };
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monday = new Date(now);
  monday.setDate(monday.getDate() + (((8 - monday.getDay()) % 7) || 7));
  const out: { key: 'tomorrow' | 'monday'; when: number }[] = [{ key: 'tomorrow', when: morning(tomorrow) }];
  if (monday.toDateString() !== tomorrow.toDateString()) out.push({ key: 'monday', when: morning(monday) });
  return out;
}
