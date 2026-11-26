import { ChatClient } from '../src/features/chat/api';
import { distanceMeters, fromWorld, mapsAppUrl, offsetOf, tilePath, tilesFor, toWorld } from '../src/features/chat/geo';
import { lastMessageOf, messagePatches, messagesFromStore } from '../src/features/chat/odoo';
import { draftPlace, draftPoll, growOptions, liveRunning, placeFrom, pollFrom, pollProblem, previewText, richOf, richPostData } from '../src/features/chat/rich';

const mockRoute = jest.fn();
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/api/odoo', () => ({ route: (...args: unknown[]) => mockRoute(...args), rpc: jest.fn(), bearer: jest.fn(), sessionCookie: jest.fn(), ApiError: class extends Error {} }));
jest.mock('../src/features/chat/chat', () => ({ chatClient: () => null, newKey: () => 'key' }));

const poll = {
  question: 'Lunch where?',
  multiple: false,
  closed: false,
  closed_at: null,
  voters_count: 3,
  options: [
    { id: 41, label: 'Padang', votes: 2, voter_ids: [7, 12] },
    { id: 42, label: 'Sushi', votes: 1, voter_ids: [3] },
  ],
};
const live = {
  latitude: -6.200123,
  longitude: 106.816666,
  accuracy: 12,
  name: false,
  address: false,
  live: true,
  live_until: '2026-11-25 06:15:00',
  ended: false,
  ended_at: null,
  end_reason: null,
  seq: 7,
  updated_at: '2026-11-25 05:16:40',
  map: '/kaitech_chat/location/902/map?seq=7',
};
const partners = [
  { id: 7, name: 'Ana' },
  { id: 12, name: 'Budi' },
  { id: 3, name: 'Citra' },
];

describe('reading the four kinds from the store', () => {
  it('names every voter of a poll from the partners in the same payload', () => {
    const [message] = messagesFromStore({ 'res.partner': partners, 'mail.message': [{ id: 901, model: 'discuss.channel', res_id: 12, body: 'Lunch where?', message_type: 'comment', kaitech_chat_kind: 'poll', kaitech_chat_poll: poll }] }, 7);
    expect(message.rich).toEqual({
      poll: {
        question: 'Lunch where?',
        multiple: false,
        closed: false,
        closedAt: null,
        votersCount: 3,
        options: [
          { id: 41, label: 'Padang', votes: 2, voters: [{ id: 7, name: 'Ana' }, { id: 12, name: 'Budi' }] },
          { id: 42, label: 'Sushi', votes: 1, voters: [{ id: 3, name: 'Citra' }] },
        ],
      },
    });
  });

  it('reads a live share with its end time and treats it as ended once the time passed', () => {
    const rich = richOf({ kaitech_chat_kind: 'live_location', kaitech_chat_location: live });
    expect(rich && 'location' in rich && rich.location).toMatchObject({ live: true, name: '', address: '', seq: 7, liveUntil: Date.UTC(2026, 10, 25, 6, 15, 0) });
    const place = placeFrom(live)!;
    expect(liveRunning(place, Date.UTC(2026, 10, 25, 6, 14, 59))).toBe(true);
    expect(liveRunning(place, Date.UTC(2026, 10, 25, 6, 15, 0))).toBe(false);
    expect(liveRunning({ ...place, ended: true }, 0)).toBe(false);
  });

  it('keeps no live fields on a plain location even when the server sends them', () => {
    expect(placeFrom({ latitude: 1, longitude: 2, live: false, live_until: '2026-11-25 06:15:00', ended: true, end_reason: 'expired' })).toMatchObject({ live: false, liveUntil: null, ended: false, endReason: null });
  });

  it('refuses a poll without options and a point outside the globe', () => {
    expect(pollFrom({ question: 'q', options: [] })).toBeNull();
    expect(placeFrom({ latitude: 91, longitude: 0 })).toBeNull();
    expect(placeFrom({ latitude: 0, longitude: '1' })).toBeNull();
    expect(richOf({ kaitech_chat_kind: 'poll', kaitech_chat_poll: false })).toBeNull();
  });

  it('updates a poll from a websocket insert that carries only the poll field and clears it once deleted', () => {
    const update = messagePatches({ 'res.partner': partners, 'mail.message': [{ id: 901, kaitech_chat_poll: { ...poll, closed: true } }] }).get(901);
    expect(update?.rich && 'poll' in update.rich && update.rich.poll.closed).toBe(true);
    const removed = messagePatches({ 'mail.message': [{ id: 901, body: '', kaitech_chat_kind: false }] }).get(901);
    expect(removed).toHaveProperty('rich', undefined);
    const untouched = messagePatches({ 'mail.message': [{ id: 901, starred: true }] }).get(901);
    expect(untouched).not.toHaveProperty('rich');
  });
});

describe('sending the four kinds', () => {
  beforeEach(() => mockRoute.mockReset());

  it('posts a poll with trimmed options and no body or attachments', async () => {
    mockRoute.mockResolvedValue({ message_id: 9 });
    const client = new ChatClient({ id: 'a', origin: 'https://lab0.test', db: 'lab0' } as never);
    await client.post({ key: 'k1', channelId: 12, body: 'ignored', parentId: 880, partnerIds: [], mentionTokens: {}, files: [], rich: { poll: draftPoll('  Lunch where? ', [' Padang ', 'Sushi', ''], true) } });
    const [, path, params] = mockRoute.mock.calls[0];
    expect(path).toBe('/mail/message/post');
    expect(params.kaitech_chat_send_key).toBe('k1');
    expect(params.post_data).toEqual({ message_type: 'comment', subtype_xmlid: 'mail.mt_comment', parent_id: 880, kaitech_chat_poll: { question: 'Lunch where?', options: ['Padang', 'Sushi'], multiple: true } });
  });

  it('posts a picked place with its name and a live share with only its duration', () => {
    expect(richPostData({ location: draftPlace({ latitude: -6.20012345, longitude: 106.81666678, accuracy: 8.26, name: 'Monas', address: 'Jakarta' }) })).toEqual({
      kaitech_chat_location: { latitude: -6.200123, longitude: 106.816667, accuracy: 8.3, name: 'Monas', address: 'Jakarta' },
    });
    expect(richPostData({ location: draftPlace({ latitude: 1, longitude: 2, accuracy: null, name: 'Home' }, 60) })).toEqual({ kaitech_chat_location: { latitude: 1, longitude: 2, live_minutes: 60 } });
  });

  it('leaves name and address out when the point has none, so the server shows Location', () => {
    expect(richPostData({ location: draftPlace({ latitude: 1, longitude: 2 }) })).toEqual({ kaitech_chat_location: { latitude: 1, longitude: 2 } });
  });
});

describe('poll limits', () => {
  it('needs a question and two distinct options', () => {
    expect(pollProblem('', ['a', 'b'])).toBe('question');
    expect(pollProblem('q', ['a', ' '])).toBe('tooFew');
    expect(pollProblem('q', ['Yes', ' yes '])).toBe('duplicate');
    expect(pollProblem('q', ['a', 'b'])).toBeNull();
  });

  it('allows twelve options of 100 characters and no more', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => `o${index}`);
    expect(pollProblem('q', twelve)).toBeNull();
    expect(pollProblem('q', [...twelve, 'o12'])).toBe('tooMany');
    expect(pollProblem('q', ['a'.repeat(100), 'b'])).toBeNull();
    expect(pollProblem('q', ['a'.repeat(101), 'b'])).toBe('tooLong');
    expect(pollProblem('q'.repeat(301), ['a', 'b'])).toBe('question');
  });

  it('adds an empty option after the last filled one until twelve, and keeps at least two', () => {
    expect(growOptions(['a', ''])).toEqual(['a', '']);
    expect(growOptions(['a', 'b'])).toEqual(['a', 'b', '']);
    expect(growOptions(['a', 'b', '', ''])).toEqual(['a', 'b', '']);
    expect(growOptions([''])).toEqual(['', '']);
    const twelve = Array.from({ length: 12 }, (_, index) => `o${index}`);
    expect(growOptions(twelve)).toHaveLength(12);
  });
});

describe('previews', () => {
  const t = (key: string) => ({ 'rich.poll': 'Poll', 'rich.location': 'Location', 'rich.liveLocation': 'Live location', 'rich.sticker': 'Sticker', 'rich.gif': 'GIF' })[key] ?? key;

  it('shows the kind and its detail in the conversation list instead of the text fallback', () => {
    const [message] = messagesFromStore({ 'mail.message': [{ id: 901, model: 'discuss.channel', res_id: 12, body: 'Lunch where?\nPadang\nSushi', message_type: 'comment', kaitech_chat_kind: 'poll', kaitech_chat_poll: poll }] }, 7);
    const last = lastMessageOf(message, 'Lunch where? Padang Sushi');
    expect(previewText(last.rich!, t)).toBe('Poll: Lunch where?');
    const [shared] = messagesFromStore({ 'mail.message': [{ id: 902, model: 'discuss.channel', res_id: 12, body: 'Live location', message_type: 'comment', kaitech_chat_kind: 'live_location', kaitech_chat_location: live }] }, 7);
    expect(previewText(lastMessageOf(shared, '').rich!, t)).toBe('Live location');
  });
});

describe('map math', () => {
  it('turns a point into world pixels and back', () => {
    const point = { latitude: -6.2, longitude: 106.816666 };
    const world = toWorld(point, 16);
    const back = fromWorld(world.x, world.y, 16);
    expect(distanceMeters(point, back)).toBeLessThan(0.01);
  });

  it('covers the view with tiles plus one tile of margin and wraps x around the antimeridian', () => {
    const tiles = tilesFor({ latitude: 0, longitude: 179.99 }, 3, 512, 256);
    expect(tiles.every((tile) => tile.x >= 0 && tile.x < 8)).toBe(true);
    expect(new Set(tiles.map((tile) => tile.key)).size).toBe(tiles.length);
    expect(tiles.some((tile) => tile.x === 0)).toBe(true);
    expect(tilePath(tiles[0])).toMatch(/^\/kaitech_chat\/map\/tile\/3\/\d+\/\d+\.png$/);
    expect(tilesFor({ latitude: 0, longitude: 0 }, 3, 0, 100)).toEqual([]);
  });

  it('places a marker across the antimeridian on the near side', () => {
    expect(offsetOf({ latitude: 0, longitude: 179.9 }, 10, { latitude: 0, longitude: -179.9 }).dx).toBeGreaterThan(0);
  });

  it('opens a geo link on Android and Apple Maps on iOS', () => {
    expect(mapsAppUrl({ latitude: -6.2, longitude: 106.8, name: 'Monas' }, 'android')).toBe('geo:-6.200000,106.800000?q=-6.200000,106.800000(Monas)');
    expect(mapsAppUrl({ latitude: -6.2, longitude: 106.8 }, 'ios')).toBe('https://maps.apple.com/?ll=-6.200000,106.800000&q=-6.200000,106.800000');
  });
});
