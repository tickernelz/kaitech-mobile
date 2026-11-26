import type { GifMedia, Media, Rich, Sticker } from './types';

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

export function richOf(raw: Raw): Rich | null {
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

export function richPostData(rich: Rich): Record<string, unknown> {
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

export function richMedia(rich: Rich): Media {
  if ('sticker' in rich) return { url: rich.sticker.url, width: rich.sticker.width, height: rich.sticker.height };
  return rich.gif.gif ?? rich.gif.preview ?? (rich.gif.mp4 as Media);
}

export function richSize(media: Pick<Media, 'width' | 'height'>, box: number): { width: number; height: number } {
  const scale = Math.min(box / media.width, box / media.height);
  return { width: Math.round(media.width * scale), height: Math.round(media.height * scale) };
}
