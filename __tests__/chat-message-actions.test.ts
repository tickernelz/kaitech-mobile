import { featuresFromSession, hasFeature } from '../src/features/chat/features';
import { editableSource } from '../src/features/chat/markdown';
import { mentionsInBody, odooDate, odooDatetime } from '../src/features/chat/messageActions';
import { editedBody, isRemoved, messagePatches, messagesFromStore } from '../src/features/chat/odoo';

jest.mock('../src/api/odoo', () => ({ route: jest.fn(), rpc: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, patchMessages: jest.fn(), refreshConversations: jest.fn() }));

describe('edited, pinned and starred messages', () => {
  it('reads the edited marker out of the body and keeps pin and star', () => {
    const [message] = messagesFromStore(
      {
        'mail.message': [
          {
            id: 5,
            body: ['markup', '<p>halo **semua**<span class="o-mail-Message-edited"></span></p>'],
            model: 'discuss.channel',
            res_id: 4,
            message_type: 'comment',
            pinned_at: '2026-11-21 08:00:00',
            starred: true,
          },
        ],
      },
      9,
    );
    expect(message).toMatchObject({ body: '<p>halo **semua**</p>', edited: true, pinnedAt: '2026-11-21 08:00:00', starred: true });
  });

  it('turns the update_content answer into a patch', () => {
    const patches = messagePatches({
      'mail.message': [
        { id: 5, body: ['markup', '<p>baru<span class="o-mail-Message-edited"/></p>'], attachment_ids: [31], pinned_at: false, write_date: '2026-11-21 08:00:00' },
        { id: 6, body: ['markup', '<span class="o-mail-Message-edited"></span>'], res_id: 4, model: 'discuss.channel', attachment_ids: [] },
      ],
      'ir.attachment': [{ id: 31, name: 'a.pdf', mimetype: 'application/pdf', file_size: 10 }],
    });
    expect([...patches.keys()]).toEqual([5, 6]);
    expect(patches.get(6)).toEqual({ body: '', edited: true, attachments: [] });
    expect(patches.get(5)).toMatchObject({ body: '<p>baru</p>', edited: true, pinnedAt: null, attachments: [{ id: 31, name: 'a.pdf' }] });
  });

  it('patches only the fields the bus sent', () => {
    expect(messagePatches({ 'mail.message': [{ id: 7, pinned_at: '2026-11-21 08:00:00' }] }).get(7)).toEqual({ pinnedAt: '2026-11-21 08:00:00' });
    expect(messagePatches({ 'mail.message': [{ id: 7, starred: false }] }).get(7)).toEqual({ starred: false });
    expect(messagePatches({ 'mail.message': [{ id: 7, write_date: 'x' }] }).size).toBe(0);
  });

  it('marks an emptied comment as removed and nothing else', () => {
    expect(isRemoved({ type: 'comment', body: '', attachments: [] })).toBe(true);
    expect(isRemoved({ type: 'comment', body: '<p><br></p>', attachments: [] })).toBe(true);
    expect(isRemoved({ type: 'comment', body: '<p>x</p>', attachments: [] })).toBe(false);
    expect(isRemoved({ type: 'notification', body: '', attachments: [] })).toBe(false);
    expect(editedBody('<p>a</p>')).toEqual({ body: '<p>a</p>', edited: false });
  });
});

describe('editing a sent message', () => {
  it('gives back the text the sender typed, Markdown and mentions included', () => {
    const body = '<p>Tolong cek <a href="/odoo/res.partner/7" class="o_mail_redirect" data-oe-id="7" data-oe-model="res.partner" target="_blank">@Budi Santoso</a> **besok**<br>baris dua</p>';
    expect(editableSource(body)).toBe('Tolong cek @Budi Santoso **besok**\nbaris dua');
    expect(mentionsInBody(body)).toEqual([{ id: 7, name: 'Budi Santoso' }]);
  });

  it('falls back to plain text for rich HTML from the web', () => {
    expect(editableSource('<ul><li>satu</li><li>dua</li></ul>')).toContain('satu');
  });
});

describe('server dates', () => {
  it('sends datetimes in UTC and dates in local time', () => {
    expect(odooDatetime(Date.UTC(2026, 10, 21, 3, 4, 5))).toBe('2026-11-21 03:04:05');
    expect(odooDate(new Date(2026, 10, 21, 23, 30).getTime())).toBe('2026-11-21');
  });
});

describe('featuresFromSession', () => {
  const info = {
    storeData: {
      Store: {
        self_partner: { id: 3, type: 'partner' },
        kaitech_chat_features: ['forward', 'read_by', 'meeting'],
        kaitech_chat_can_make_task: true,
        hasGifPickerFeature: false,
        kaitech_chat_coworker_partner_id: 8,
      },
      'res.partner': [{ id: 3, main_user_id: 2 }],
      'res.users': [{ id: 2, is_admin: true }],
    },
  };

  it('reads the Chat flags the web reads', () => {
    const features = featuresFromSession(info);
    expect(hasFeature(features, 'forward')).toBe(true);
    expect(hasFeature(features, 'translate')).toBe(false);
    expect(features).toMatchObject({ isAdmin: true, canMakeTask: true, gif: true, coworkerPartnerId: 8 });
  });

  it('turns everything off when the server sends no store', () => {
    expect(featuresFromSession({}).on).toEqual([]);
    expect(featuresFromSession(null).isAdmin).toBe(false);
  });
});
