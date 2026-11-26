import { ChatClient } from '../src/features/chat/api';
import { deleteBefore, pageOf, shelfOf } from '../src/features/chat/composerExtras';
import { messagePatches, messagesFromStore } from '../src/features/chat/odoo';
import { gifFrom, mediaSource, richOf, richPostData, stickerFrom } from '../src/features/chat/rich';
import { dragFrom, dragTo, releaseOf, sendModeOf, tooShort } from '../src/features/chat/ui/composer/gesture';

const mockRoute = jest.fn();
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/api/odoo', () => ({ route: (...args: unknown[]) => mockRoute(...args), rpc: jest.fn(), bearer: jest.fn(), sessionCookie: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, newKey: () => 'key' }));

const packSticker = { source: 'pack', id: 5, pack_id: 1, alt: 'Thumbs up', animated: true, width: 512, height: 512, url: '/kaitech_chat/sticker/5/image?unique=9f', poster: '/kaitech_chat/sticker/5/poster?unique=9f' };
const providerSticker = { source: 'provider', id: 'kl-77', pack_id: false, alt: 'Cat', animated: true, width: 200, height: 180, url: 'https://static.klipy.com/s.webp', poster: 'https://static.klipy.com/s.png' };
const gif = {
  provider: 'klipy',
  id: 'abc123',
  title: 'Cat typing',
  mp4: { url: 'https://static.klipy.com/a.mp4', width: 320, height: 240 },
  gif: { url: 'https://static.klipy.com/a.gif', width: 320, height: 240 },
  preview: { url: 'https://static.klipy.com/a.jpg', width: 320, height: 240 },
};

describe('send button mode', () => {
  it('shows the microphone for an empty field and for spaces only', () => {
    expect(sendModeOf({ text: '', files: 0, locked: false })).toBe('mic');
    expect(sendModeOf({ text: '   \n ', files: 0, locked: false })).toBe('mic');
  });

  it('turns into send while there is text and back to the microphone once it is deleted', () => {
    const typed = ['h', 'ha', 'hai', 'ha', 'h', ''].map((text) => sendModeOf({ text, files: 0, locked: false }));
    expect(typed).toEqual(['send', 'send', 'send', 'send', 'send', 'mic']);
  });

  it('sends staged files without text and a locked recording as a voice note', () => {
    expect(sendModeOf({ text: '', files: 1, locked: false })).toBe('send');
    expect(sendModeOf({ text: 'x', files: 0, locked: true })).toBe('voice');
  });
});

describe('voice hold gesture', () => {
  const start = dragFrom(300, 700);

  it('ignores movement inside the 12 dp direction slop', () => {
    const moved = dragTo(start, 300 - 8, 700 - 8);
    expect(moved).toMatchObject({ axis: 'none', dx: 0, dy: 0, locked: false });
    expect(releaseOf(moved)).toBe('send');
  });

  it('cancels from exactly 96 dp to the left, not 95', () => {
    expect(releaseOf(dragTo(start, 300 - 95, 700))).toBe('send');
    expect(releaseOf(dragTo(start, 300 - 96, 700))).toBe('cancel');
  });

  it('locks from exactly 64 dp up, not 63, and keeps recording on release', () => {
    expect(dragTo(start, 300, 700 - 63).locked).toBe(false);
    const locked = dragTo(start, 300, 700 - 64);
    expect(locked.locked).toBe(true);
    expect(releaseOf(locked)).toBe('keep');
    expect(dragTo(locked, 0, 700)).toBe(locked);
  });

  it('keeps the first axis, so a diagonal never both locks and cancels', () => {
    const sideways = dragTo(dragTo(start, 300 - 20, 700 - 5), 300 - 120, 700 - 120);
    expect(sideways).toMatchObject({ axis: 'x', dy: 0, locked: false });
    expect(releaseOf(sideways)).toBe('cancel');
    const upward = dragTo(dragTo(start, 300 - 5, 700 - 20), 300 - 150, 700 - 30);
    expect(upward).toMatchObject({ axis: 'y', dx: 0 });
    expect(releaseOf(upward)).toBe('send');
  });

  it('treats under 1000 ms as too short and 1000 ms as a message', () => {
    expect(tooShort(999)).toBe(true);
    expect(tooShort(1000)).toBe(false);
  });
});

describe('emoji backspace', () => {
  it.each([
    ['ab', 2, 'a'],
    ['a👍', 3, 'a'],
    ['x👍🏽', 5, 'x'],
    ['👨‍👩‍👧', 8, ''],
    ['🇮🇩🇯🇵', 8, '🇮🇩'],
    ['1️⃣', 3, ''],
    ['❤️', 2, ''],
  ])('removes one whole character from %s', (text, cursor, left) => {
    expect(deleteBefore(text, cursor)).toEqual({ text: left, cursor: left.length });
  });

  it('keeps the text after the cursor and does nothing at the start', () => {
    expect(deleteBefore('a😀b', 3)).toEqual({ text: 'ab', cursor: 1 });
    expect(deleteBefore('abc', 0)).toEqual({ text: 'abc', cursor: 0 });
  });
});

describe('rich messages', () => {
  it('reads pack and provider stickers and refuses broken ones', () => {
    expect(stickerFrom(packSticker)).toMatchObject({ source: 'pack', id: 5, packId: 1, alt: 'Thumbs up', url: packSticker.url, poster: packSticker.poster });
    expect(stickerFrom(providerSticker)).toMatchObject({ source: 'provider', id: 'kl-77', packId: null });
    expect(stickerFrom({ ...packSticker, id: 'x' })).toBeNull();
    expect(stickerFrom({ ...providerSticker, url: '' })).toBeNull();
    expect(stickerFrom(null)).toBeNull();
  });

  it('reads a GIF with only some formats and refuses one without any', () => {
    expect(gifFrom(gif)).toMatchObject({ id: 'abc123', title: 'Cat typing', gif: gif.gif, mp4: gif.mp4, preview: gif.preview });
    expect(gifFrom({ id: 'x', preview: gif.preview })).toMatchObject({ gif: null, mp4: null });
    expect(gifFrom({ id: 'x' })).toBeNull();
  });

  it('posts exactly one rich key, never a body or files', async () => {
    mockRoute.mockResolvedValue({ message_id: 9, store_data: {} });
    const client = new ChatClient({ id: 'a' } as never);
    const sticker = stickerFrom(packSticker)!;
    await client.post({ key: 'k1', channelId: 12, body: '', parentId: 880, partnerIds: [], mentionTokens: {}, files: [], rich: { sticker } });
    expect(mockRoute.mock.calls[0][2].post_data).toEqual({ message_type: 'comment', subtype_xmlid: 'mail.mt_comment', parent_id: 880, kaitech_chat_sticker: { id: 5 } });
    expect(mockRoute.mock.calls[0][2].kaitech_chat_send_key).toBe('k1');
    expect(richPostData({ sticker: stickerFrom(providerSticker)! })).toEqual({ kaitech_chat_sticker: { provider_id: 'kl-77' } });
    expect(richPostData({ gif: gifFrom(gif)! })).toEqual({ kaitech_chat_gif: { id: 'abc123' } });
  });

  it('shows stickers and GIFs from the store and clears them when the message is deleted', () => {
    const data = {
      'mail.message': [
        { id: 903, model: 'discuss.channel', res_id: 12, body: 'Thumbs up', message_type: 'comment', kaitech_chat_kind: 'sticker', kaitech_chat_sticker: packSticker },
        { id: 904, model: 'discuss.channel', res_id: 12, body: 'Cat typing', message_type: 'comment', kaitech_chat_kind: 'gif', kaitech_chat_gif: gif },
        { id: 905, model: 'discuss.channel', res_id: 12, body: 'Poll: lunch?', message_type: 'comment', kaitech_chat_kind: 'poll' },
      ],
    };
    const [sticker, animated, poll] = messagesFromStore(data, 3);
    expect(sticker.rich).toEqual({ sticker: stickerFrom(packSticker) });
    expect(animated.rich).toEqual({ gif: gifFrom(gif) });
    expect(poll.rich).toBeUndefined();
    expect(poll.body).toBe('Poll: lunch?');
    const cleared = messagePatches({ 'mail.message': [{ id: 903, body: '', kaitech_chat_kind: false }] }).get(903);
    expect(cleared).toHaveProperty('rich', undefined);
    expect(richOf({ kaitech_chat_kind: 'sticker', kaitech_chat_sticker: false })).toBeNull();
  });

  it('pages provider results with attribution and keeps only pack stickers on the shelf', () => {
    expect(pageOf({ results: [gif, { id: 'bad' }], next: '24', attribution: { placeholder: 'Search KLIPY', mark: 'Powered by KLIPY' } }, gifFrom)).toMatchObject({
      items: [{ id: 'abc123' }],
      next: '24',
      attribution: { placeholder: 'Search KLIPY', mark: 'Powered by KLIPY' },
    });
    expect(pageOf({ results: [], next: '' }, gifFrom)).toEqual({ items: [], next: null, attribution: null });
    const shelf = shelfOf({ packs: [{ id: 1, name: 'Kai', stickers: [packSticker, providerSticker] }, { id: 2, name: 'Empty', stickers: [] }], recent: [5, 99], favorites: [5] });
    expect(shelf.packs).toHaveLength(1);
    expect(shelf.packs[0].stickers.map((item) => item.id)).toEqual([5]);
    expect(shelf.recent.map((item) => item.id)).toEqual([5]);
    expect(shelfOf(null)).toEqual({ packs: [], recent: [], favorites: [] });
  });
});

describe('media sources', () => {
  const cookie = { Cookie: 'session_id=abc' };

  it('sends the session cookie only to the account server', () => {
    expect(mediaSource('https://lab0.kaitech.io', '/web/sticker/1', cookie)).toEqual({ uri: 'https://lab0.kaitech.io/web/sticker/1', headers: cookie });
    expect(mediaSource('https://lab0.kaitech.io/', 'https://lab0.kaitech.io/web/sticker/2', cookie)).toEqual({ uri: 'https://lab0.kaitech.io/web/sticker/2', headers: cookie });
    expect(mediaSource('https://lab0.kaitech.io', 'https://static.klipy.com/s/1.webp', cookie)).toEqual({ uri: 'https://static.klipy.com/s/1.webp' });
    expect(mediaSource('https://lab0.kaitech.io', 'https://lab0.kaitech.io.evil.test/x.webp', cookie)).toEqual({ uri: 'https://lab0.kaitech.io.evil.test/x.webp' });
  });

  it('refuses plain http media from another host and loads nothing without a url', () => {
    expect(mediaSource('https://lab0.kaitech.io', 'http://static.klipy.com/s/1.webp', cookie)).toBeNull();
    expect(mediaSource('https://lab0.kaitech.io', undefined, cookie)).toBeNull();
  });
});
