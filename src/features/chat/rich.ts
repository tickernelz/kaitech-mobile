import type { EndReason, GifMedia, Media, MediaRich, Place, Poll, PollOption, Rich, RichPreview, Sticker } from './types';

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw => value !== null && typeof value === 'object' && !Array.isArray(value);
const size = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1);

function mediaFrom(value: unknown): Media | null {
  if (!isRecord(value) || typeof value.url !== 'string' || !value.url) return null;
  return { url: value.url, width: size(value.width), height: size(value.height) };
}

export function stickerFrom(value: unknown): Sticker | null {
  if (!isRecord(value) || typeof value.url !== 'string' || !value.url) return null;
  const provider = value.source === 'provider';
  const id = provider ? (typeof value.id === 'string' && value.id ? value.id : null) : typeof value.id === 'number' && value.id > 0 ? value.id : null;
  if (id === null) return null;
  return {
    source: provider ? 'provider' : 'pack',
    id,
    packId: typeof value.pack_id === 'number' && value.pack_id > 0 ? value.pack_id : null,
    alt: typeof value.alt === 'string' ? value.alt : '',
    animated: value.animated === true,
    width: size(value.width),
    height: size(value.height),
    url: value.url,
    poster: typeof value.poster === 'string' && value.poster ? value.poster : value.url,
  };
}

export function gifFrom(value: unknown): GifMedia | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id ? value.id : typeof value.id === 'number' ? String(value.id) : null;
  const gif = mediaFrom(value.gif);
  const mp4 = mediaFrom(value.mp4);
  const preview = mediaFrom(value.preview);
  if (!id || !(gif ?? mp4 ?? preview)) return null;
  return { provider: typeof value.provider === 'string' ? value.provider : '', id, title: typeof value.title === 'string' ? value.title : '', gif, mp4, preview };
}

const endReasons: EndReason[] = ['stopped', 'expired', 'left', 'deleted'];
export const pollLimits = { question: 300, option: 100, minOptions: 2, maxOptions: 12 } as const;
export const liveDurations = [15, 60, 480] as const;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const label = (value: unknown) => (typeof value === 'string' ? value : '');

export function stampOf(value: unknown): number | null {
  const match = typeof value === 'string' ? /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)/.exec(value) : null;
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

function optionFrom(value: unknown, names: Map<number, string>): PollOption | null {
  if (!isRecord(value) || !finite(value.id) || typeof value.label !== 'string') return null;
  const voterIds = Array.isArray(value.voter_ids) ? value.voter_ids.filter((item): item is number => finite(item) && item > 0) : [];
  return { id: value.id, label: value.label, votes: finite(value.votes) ? value.votes : voterIds.length, voters: voterIds.map((id) => ({ id, name: names.get(id) ?? '' })) };
}

export function pollFrom(value: unknown, names: Map<number, string> = new Map()): Poll | null {
  if (!isRecord(value) || typeof value.question !== 'string' || !Array.isArray(value.options)) return null;
  const options = value.options.map((item) => optionFrom(item, names)).filter((item): item is PollOption => item !== null);
  if (!options.length) return null;
  const voters = new Set(options.flatMap((option) => option.voters.map((voter) => voter.id)));
  return {
    question: value.question,
    multiple: value.multiple === true,
    closed: value.closed === true,
    closedAt: stampOf(value.closed_at),
    votersCount: finite(value.voters_count) ? value.voters_count : voters.size,
    options,
  };
}

export function placeFrom(value: unknown): Place | null {
  if (!isRecord(value) || !finite(value.latitude) || !finite(value.longitude)) return null;
  if (Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180) return null;
  const live = value.live === true;
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    accuracy: finite(value.accuracy) && value.accuracy >= 0 ? value.accuracy : null,
    name: label(value.name),
    address: label(value.address),
    live,
    liveUntil: live ? stampOf(value.live_until) : null,
    ended: live && value.ended === true,
    endedAt: live ? stampOf(value.ended_at) : null,
    endReason: live && endReasons.includes(value.end_reason as EndReason) ? (value.end_reason as EndReason) : null,
    seq: finite(value.seq) ? value.seq : 0,
    updatedAt: stampOf(value.updated_at),
    map: typeof value.map === 'string' && value.map ? value.map : null,
  };
}

export function isRich(value: unknown): value is Rich {
  if (!isRecord(value)) return false;
  if (isRecord(value.sticker)) return typeof value.sticker.url === 'string' && (typeof value.sticker.id === 'number' || typeof value.sticker.id === 'string');
  if (isRecord(value.gif)) return typeof value.gif.id === 'string' && !!(value.gif.gif ?? value.gif.mp4 ?? value.gif.preview);
  if (isRecord(value.poll)) return typeof value.poll.question === 'string' && Array.isArray(value.poll.options);
  if (isRecord(value.location)) return finite(value.location.latitude) && finite(value.location.longitude);
  return false;
}

export type Cached<T> = Omit<T, 'rich'> & { rich?: unknown; content?: unknown };

export function toCache<T extends { rich?: Rich }>(item: T): Cached<T> {
  if (!item.rich) return item;
  const { rich, ...rest } = item;
  return 'sticker' in rich || 'gif' in rich ? { ...rest, rich } : { ...rest, content: rich };
}

export function fromCache<T extends { rich?: Rich }>(raw: Cached<T>): T {
  if (raw.rich === undefined && raw.content === undefined) return raw as T;
  const { rich, content, ...rest } = raw;
  const found = content ?? rich;
  return (isRich(found) ? { ...rest, rich: found } : rest) as T;
}

export function richPreview(rich: Rich): RichPreview {
  if ('poll' in rich) return { kind: 'poll', detail: rich.poll.question };
  if ('location' in rich) return rich.location.live ? { kind: 'liveLocation', detail: '' } : { kind: 'location', detail: rich.location.name };
  if ('sticker' in rich) return { kind: 'sticker', detail: rich.sticker.alt ?? '' };
  return { kind: 'gif', detail: rich.gif?.title ?? '' };
}

export type RichKey = `rich.${RichPreview['kind']}`;

export function previewText(preview: RichPreview, t: (key: RichKey) => string): string {
  return [t(`rich.${preview.kind}`), preview.detail].filter(Boolean).join(': ');
}

export function richText(rich: Rich, t: (key: RichKey) => string): string {
  return previewText(richPreview(rich), t);
}

export function liveRunning(place: Place, now: number): boolean {
  return place.live && !place.ended && (place.liveUntil === null || place.liveUntil > now);
}

export function richOf(raw: Raw, names: Map<number, string> = new Map()): Rich | null {
  if (raw.kaitech_chat_kind === 'poll' || (!('kaitech_chat_kind' in raw) && isRecord(raw.kaitech_chat_poll))) {
    const poll = pollFrom(raw.kaitech_chat_poll, names);
    return poll ? { poll } : null;
  }
  if (raw.kaitech_chat_kind === 'location' || raw.kaitech_chat_kind === 'live_location' || (!('kaitech_chat_kind' in raw) && isRecord(raw.kaitech_chat_location))) {
    const location = placeFrom(raw.kaitech_chat_location);
    return location ? { location } : null;
  }
  if (raw.kaitech_chat_kind === 'sticker') {
    const sticker = stickerFrom(raw.kaitech_chat_sticker);
    return sticker ? { sticker } : null;
  }
  if (raw.kaitech_chat_kind === 'gif') {
    const gif = gifFrom(raw.kaitech_chat_gif);
    return gif ? { gif } : null;
  }
  return null;
}

export function draftPoll(question: string, options: string[], multiple: boolean): Poll {
  return {
    question: question.trim(),
    multiple,
    closed: false,
    closedAt: null,
    votersCount: 0,
    options: options.map((option) => option.trim()).filter(Boolean).map((option, index) => ({ id: -(index + 1), label: option, votes: 0, voters: [] })),
  };
}

export function growOptions(options: string[]): string[] {
  const next = options.length ? [...options] : [''];
  while (next.length > pollLimits.minOptions && !next[next.length - 1].trim() && !next[next.length - 2].trim()) next.pop();
  if (next[next.length - 1].trim() && next.length < pollLimits.maxOptions) next.push('');
  while (next.length < pollLimits.minOptions) next.push('');
  return next;
}

export type PollProblem = 'question' | 'tooFew' | 'tooMany' | 'tooLong' | 'duplicate';

export function pollProblem(question: string, options: string[]): PollProblem | null {
  const asked = question.trim();
  const filled = options.map((option) => option.trim()).filter(Boolean);
  if (!asked || asked.length > pollLimits.question) return 'question';
  if (filled.length < pollLimits.minOptions) return 'tooFew';
  if (filled.length > pollLimits.maxOptions) return 'tooMany';
  if (filled.some((option) => option.length > pollLimits.option)) return 'tooLong';
  const folded = filled.map((option) => option.toLocaleLowerCase());
  if (new Set(folded).size !== folded.length) return 'duplicate';
  return null;
}

export function draftPlace(point: { latitude: number; longitude: number; accuracy?: number | null; name?: string; address?: string }, liveMinutes?: number): Place {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: point.accuracy ?? null,
    name: (point.name ?? '').slice(0, 120),
    address: (point.address ?? '').slice(0, 300),
    live: liveMinutes !== undefined,
    liveUntil: liveMinutes !== undefined ? Date.now() + liveMinutes * 60000 : null,
    ...(liveMinutes !== undefined ? { liveMinutes } : {}),
    ended: false,
    endedAt: null,
    endReason: null,
    seq: 0,
    updatedAt: null,
    map: null,
  };
}

const coordinate = (value: number) => Math.round(value * 1e6) / 1e6;

export function richPostData(rich: Rich): Record<string, unknown> {
  if ('poll' in rich) return { kaitech_chat_poll: { question: rich.poll.question, options: rich.poll.options.map((option) => option.label), multiple: rich.poll.multiple } };
  if ('location' in rich) {
    const place = rich.location;
    const accuracy = place.accuracy !== null ? { accuracy: Math.min(10000, Math.round(place.accuracy * 10) / 10) } : {};
    if (place.liveMinutes !== undefined) return { kaitech_chat_location: { latitude: coordinate(place.latitude), longitude: coordinate(place.longitude), ...accuracy, live_minutes: place.liveMinutes } };
    return {
      kaitech_chat_location: {
        latitude: coordinate(place.latitude),
        longitude: coordinate(place.longitude),
        ...accuracy,
        ...(place.name ? { name: place.name } : {}),
        ...(place.address ? { address: place.address } : {}),
      },
    };
  }
  if ('gif' in rich) return { kaitech_chat_gif: { id: rich.gif.id } };
  return { kaitech_chat_sticker: rich.sticker.source === 'provider' ? { provider_id: rich.sticker.id } : { id: rich.sticker.id } };
}

export function richUrl(origin: string, url: string): string {
  return /^https?:\/\//.test(url) ? url : `${origin.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function mediaSource(origin: string, url: string | null | undefined, cookie: Record<string, string> | null): { uri: string; headers?: Record<string, string> } | null {
  if (!url) return null;
  const uri = richUrl(origin, url);
  const home = origin.replace(/\/$/, '');
  if (uri === home || uri.startsWith(`${home}/`)) return cookie ? { uri, headers: cookie } : { uri };
  return uri.startsWith('https://') ? { uri } : null;
}

export function richMedia(rich: MediaRich): Media {
  if ('sticker' in rich) return { url: rich.sticker.url, width: rich.sticker.width, height: rich.sticker.height };
  return rich.gif.gif ?? rich.gif.preview ?? (rich.gif.mp4 as Media);
}

export function richSize(media: Pick<Media, 'width' | 'height'>, box: number): { width: number; height: number } {
  const scale = Math.min(box / media.width, box / media.height);
  return { width: Math.round(media.width * scale), height: Math.round(media.height * scale) };
}
