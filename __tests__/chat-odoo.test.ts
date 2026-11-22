import { attachmentUrl, conversationPage, lastMessageOf, membersFromStore, messagesFromStore, readState, utc } from '../src/features/chat/odoo';

const store = {
  'mail.message': [
    {
      id: 12,
      body: ['markup', '<p>Halo</p>'],
      date: '2026-11-20 01:02:03',
      author_id: 7,
      attachment_ids: [30],
      parent_id: 11,
      message_type: 'comment',
      model: 'discuss.channel',
      res_id: 4,
      reactions: [{ message: 12, content: '👍' }],
    },
    { id: 11, body: '', date: '2026-11-20 01:00:00', author_id: false, author_guest_id: 2, attachment_ids: [], parent_id: false, message_type: 'comment', model: 'discuss.channel', res_id: 4 },
    { id: 13, body: 'x', date: '2026-11-20 01:00:00', author_id: 7, model: 'res.partner', res_id: 7 },
  ],
  'res.partner': [{ id: 7, name: 'Budi Santoso' }],
  'mail.guest': [{ id: 2, name: 'Tamu' }],
  'ir.attachment': [{ id: 30, name: 'catatan.m4a', mimetype: 'audio/mp4', file_size: 2048, raw_access_token: 'tok', checksum: 'abc', voice_ids: [1] }],
  MessageReactions: [{ message: 12, content: '👍', count: 2, partners: [7, 9] }],
  'discuss.channel.member': [
    { id: 1, channel_id: { id: 4, model: 'discuss.channel' }, partner_id: 7, seen_message_id: 12 },
    { id: 2, channel_id: { id: 4, model: 'discuss.channel' }, partner_id: 9, seen_message_id: 11 },
  ],
};

describe('messagesFromStore', () => {
  it('reads channel messages in id order with authors, attachments, replies and reactions', () => {
    const messages = messagesFromStore(store, 9);
    expect(messages.map((message) => message.id)).toEqual([11, 12]);
    expect(messages[0].author).toBe('Tamu');
    expect(messages[1]).toMatchObject({
      channelId: 4,
      author: 'Budi Santoso',
      parentId: 11,
      date: Date.UTC(2026, 10, 20, 1, 2, 3),
      attachments: [{ id: 30, voice: true, accessToken: 'tok', size: 2048 }],
      reactions: [{ content: '👍', count: 2, mine: true }],
    });
    expect(messages[1].body).toBe('<p>Halo</p>');
  });
});

describe('read state', () => {
  it('counts a message read once another member has seen it', () => {
    const members = membersFromStore(store).get(4) ?? [];
    const [older, newer] = messagesFromStore(store, 9);
    expect(readState(newer, members, 9)).toBe('read');
    expect(readState(newer, members, 7)).toBe('sent');
    expect(readState(older, members, 7)).toBe('read');
  });
});

describe('conversationPage', () => {
  it('keeps known conversation types and the cursor', () => {
    const page = conversationPage({
      conversations: [
        { id: 4, type: 'chat', name: 'Budi', partner_id: 7, avatar: '/web/image/res.partner/7/avatar_128', unread: 2, muted_until: null, activity_at: '2026-11-20 01:02:03', last_message: { id: 12, author_id: 7, author: 'Budi', text: '', attachments: 1, voice: true, type: 'comment', date: '2026-11-20 01:02:03' } },
        { id: 5, type: 'livechat', name: 'x' },
      ],
      next_cursor: 'c1',
    });
    expect(page.nextCursor).toBe('c1');
    expect(page.conversations).toHaveLength(1);
    expect(page.conversations[0]).toMatchObject({ id: 4, partnerId: 7, unread: 2, last: { voice: true, attachments: 1 } });
  });
});

describe('call previews', () => {
  const row = (last: Record<string, unknown>) => conversationPage({ conversations: [{ id: 4, type: 'chat', name: 'Budi', last_message: { id: 12, author_id: 7, author: 'Budi', attachments: 0, date: '2026-11-20 01:02:03', ...last } }] }).conversations[0].last;

  it('marks an empty notification from the server as a call and keeps other notices and comments as text', () => {
    expect(row({ type: 'notification', text: '' })?.call).toBe(true);
    expect(row({ type: 'notification', text: 'Budi joined the channel' })?.call).toBe(false);
    expect(row({ type: 'comment', text: '' })?.call).toBe(false);
  });

  it('marks a locally received call notice by its body', () => {
    const base = { id: 9, channelId: 4, authorId: 7, author: 'Budi', date: 1, attachments: [], parentId: null, reactions: [] };
    expect(lastMessageOf({ ...base, type: 'notification', body: '<div data-oe-type="call" class="o_mail_notification"></div>' }, '').call).toBe(true);
    expect(lastMessageOf({ ...base, type: 'notification', body: '<div class="o_mail_notification">joined</div>' }, 'joined').call).toBe(false);
  });
});

describe('attachmentUrl', () => {
  it('uses the image route for pictures and carries the access token', () => {
    const url = attachmentUrl('https://erp.example.com', { id: 3, name: 'a b.png', mimetype: 'image/png', size: 1, voice: false, accessToken: 't', checksum: null, url: null });
    expect(url).toBe('https://erp.example.com/web/image/3?access_token=t&filename=a+b.png');
  });
});

describe('utc', () => {
  it('returns 0 for missing dates', () => {
    expect(utc(false)).toBe(0);
  });
});
