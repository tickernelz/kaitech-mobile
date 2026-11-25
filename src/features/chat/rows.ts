import { isCallNotice } from './odoo';
import { blocksShape, bodyShape, sourceBlocks } from './markdown';
import type { Delivered } from './chat';
import type { Message, Pending } from './types';

export type Row =
  | { kind: 'day'; key: string; date: number }
  | { kind: 'message'; key: string; message: Message; showAuthor: boolean }
  | { kind: 'pending'; key: string; pending: Pending };

const groupGapMs = 5 * 60 * 1000;

export function buildRows(
  messages: Message[],
  pending: Pending[],
  delivered: Delivered[],
  sameDay: (a: number, b: number) => boolean,
  sent: Record<number, string> = {},
): Row[] {
  const rows: Row[] = [];
  const shown = new Set<string>();
  let lastDate: number | null = null;
  let previous: Message | null = null;
  for (const message of messages) {
    if (previous && isCallNotice(previous) && isCallNotice(message) && sameDay(previous.date, message.date)) continue;
    const sendKey = sent[message.id];
    const key = sendKey ? `p-${sendKey}` : `m-${message.id}`;
    if (sendKey) shown.add(sendKey);
    if (lastDate === null || !sameDay(lastDate, message.date)) rows.push({ kind: 'day', key: `day-${key}`, date: message.date });
    const continues = previous && previous.authorId === message.authorId && message.date - previous.date < groupGapMs && sameDay(previous.date, message.date) && previous.type !== 'notification';
    rows.push({ kind: 'message', key, message, showAuthor: !continues });
    previous = message;
    lastDate = message.date;
  }
  const waiting = [...delivered.map((item) => ({ ...item.pending, state: 'sending' as const })), ...pending];
  for (const item of waiting) {
    if (shown.has(item.key)) continue;
    shown.add(item.key);
    const key = `p-${item.key}`;
    if (lastDate === null || !sameDay(lastDate, item.createdAt)) rows.push({ kind: 'day', key: `day-${key}`, date: item.createdAt });
    rows.push({ kind: 'pending', key, pending: item });
    lastDate = item.createdAt;
  }
  return rows;
}

export function rowType(row: Row): string {
  if (row.kind === 'message') return `message-${bodyShape(row.message.body)}`;
  if (row.kind === 'pending' && !row.pending.files.length) return `message-${blocksShape(sourceBlocks(row.pending.text, false))}`;
  return row.kind;
}
