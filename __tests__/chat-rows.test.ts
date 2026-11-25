import { buildRows, rowType, type Row } from '../src/features/chat/rows';
import type { Message, Pending } from '../src/features/chat/types';

const day = 86400000;
const noon = new Date(2026, 10, 25, 12).getTime();
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

function message(id: number, date: number, extra: Partial<Message> = {}): Message {
  return { id, channelId: 1, authorId: 7, author: 'Me', body: `<p>m${id}</p>`, date, type: 'comment', attachments: [], reactions: [], parentId: null, ...extra };
}

function pending(key: string, text: string, createdAt: number, extra: Partial<Pending> = {}): Pending {
  return { key, accountId: 'a', channelId: 1, text, parentId: null, mentions: [], files: [], createdAt, attempts: 1, state: 'sending', error: null, ...extra };
}

const shape = (rows: Row[]) => rows.map((row) => `${row.key}:${rowType(row)}`);

describe('thread rows across a send', () => {
  const history = [message(10, noon - day), message(11, noon - day + 60000)];

  it('keeps one row with the same key and type from the queued send to the server message', () => {
    const queued = shape(buildRows(history, [pending('k1', 'hello', noon)], [], sameDay));
    const arrived = shape(buildRows([...history, message(12, noon + 1000, { body: '<p>hello</p>' })], [], [], sameDay, { 12: 'k1' }));
    expect(queued.slice(-2)).toEqual(['day-p-k1:day', 'p-k1:message-plain']);
    expect(arrived).toEqual(queued);
  });

  it('shows the send once when the server message arrives before the post answers', () => {
    const rows = buildRows([...history, message(12, noon + 1000, { body: '<p>hello</p>' })], [pending('k1', 'hello', noon)], [], sameDay, { 12: 'k1' });
    expect(rows.filter((row) => row.key === 'p-k1')).toHaveLength(1);
    expect(rows.filter((row) => row.kind === 'pending')).toHaveLength(0);
  });

  it('keeps the key while the answer came back without the message body', () => {
    const delivered = shape(buildRows(history, [], [{ key: 'k1', messageId: 12, pending: pending('k1', 'hello', noon) }], sameDay, { 12: 'k1' }));
    const arrived = shape(buildRows([...history, message(12, noon + 1000, { body: '<p>hello</p>' })], [], [], sameDay, { 12: 'k1' }));
    expect(arrived).toEqual(delivered);
  });

  it('keeps message keys of messages that were not sent from this device', () => {
    const rows = buildRows(history, [pending('k1', 'hello', noon)], [], sameDay).filter((row) => row.kind === 'message');
    expect(shape(rows)).toEqual(['m-10:message-plain', 'm-11:message-plain']);
  });

  it('gives a send with files its own row type', () => {
    const file = { key: 'f', uri: 'x', name: 'a.pdf', mimetype: 'application/pdf', size: 1, voice: false, durationMs: null, attachmentId: null, ownershipToken: null };
    const rows = buildRows(history, [pending('k2', '', noon - day + 120000, { files: [file] })], [], sameDay);
    expect(shape(rows).at(-1)).toBe('p-k2:pending');
  });
});
