import type { Delivered } from './chat';
import { isCallNotice } from './odoo';
import type { Message, Pending } from './types';

export type Row =
  | { kind: 'day'; key: string; date: number }
  | { kind: 'message'; key: string; message: Message; showAuthor: boolean }
  | { kind: 'pending'; key: string; pending: Pending };

const groupGapMs = 5 * 60 * 1000;

export function buildRows(messages: Message[], pending: Pending[], delivered: Delivered[], sameDay: (a: number, b: number) => boolean): Row[] {
  const rows: Row[] = [];
  let previous: Message | null = null;
  for (const message of messages) {
    if (previous && isCallNotice(previous) && isCallNotice(message) && sameDay(previous.date, message.date)) {
      const shown = rows[rows.length - 1];
      if (shown.kind === 'message') rows[rows.length - 1] = { ...shown, key: `m-${message.id}`, message };
      previous = message;
      continue;
    }
    if (!previous || !sameDay(previous.date, message.date)) rows.push({ kind: 'day', key: `day-${message.id}`, date: message.date });
    const continues = previous && previous.authorId === message.authorId && message.date - previous.date < groupGapMs && sameDay(previous.date, message.date) && previous.type !== 'notification';
    rows.push({ kind: 'message', key: `m-${message.id}`, message, showAuthor: !continues });
    previous = message;
  }
  for (const item of delivered) rows.push({ kind: 'pending', key: `p-${item.key}`, pending: { ...item.pending, state: 'sending' } });
  for (const item of pending) rows.push({ kind: 'pending', key: `p-${item.key}`, pending: item });
  return rows;
}
