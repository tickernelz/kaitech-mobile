import { buildRows } from '../src/features/chat/threadRows';
import type { Message } from '../src/features/chat/types';

const callBody = '<div data-oe-type="call" class="o_mail_notification"></div>';
const day = (a: number, b: number) => Math.floor(a / 86_400_000) === Math.floor(b / 86_400_000);

function message(id: number, date: number, extra: Partial<Message> = {}): Message {
  return { id, channelId: 4, authorId: 7, author: 'Budi', body: '<p>hi</p>', date, type: 'comment', attachments: [], parentId: null, reactions: [], ...extra };
}

const shownIds = (messages: Message[]) => buildRows(messages, [], [], day).flatMap((row) => (row.kind === 'message' ? [row.message.id] : []));

describe('buildRows call notices', () => {
  const morning = Date.UTC(2026, 10, 24, 5);
  const ended = message(1, morning, { type: 'notification', body: callBody, call: { minutes: 1, ongoing: false } });
  const ongoing = message(2, morning + 3_600_000, { type: 'notification', body: callBody, call: { minutes: 0, ongoing: true } });

  it('shows the newest of several call notices on one day, so a call in progress keeps its Join', () => {
    const rows = buildRows([ended, ongoing], [], [], day);
    expect(rows.map((row) => row.kind)).toEqual(['day', 'message']);
    expect(rows[1]).toMatchObject({ key: 'm-2', message: { call: { ongoing: true } } });
  });

  it('keeps call notices of different days and those split by a message', () => {
    expect(shownIds([ended, message(3, morning + 60_000), ongoing])).toEqual([1, 3, 2]);
    expect(shownIds([ended, { ...ongoing, date: morning + 86_400_000 }])).toEqual([1, 2]);
  });
});
