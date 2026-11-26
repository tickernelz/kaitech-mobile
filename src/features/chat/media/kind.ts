import type { Attachment } from '../types';

export type MediaKind = 'image' | 'video' | 'pdf' | 'file';
export type FileFamily = 'pdf' | 'doc' | 'sheet' | 'slides' | 'archive' | 'text' | 'audio' | 'image' | 'video' | 'other';

const shownImages = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp']);

const families: [FileFamily, RegExp, Set<string>][] = [
  ['pdf', /^application\/pdf$/, new Set(['pdf'])],
  ['doc', /(msword|wordprocessingml|opendocument\.text|rtf|apple\.pages)/, new Set(['doc', 'docx', 'odt', 'rtf', 'pages'])],
  ['sheet', /(ms-excel|spreadsheetml|opendocument\.spreadsheet|text\/csv|apple\.numbers)/, new Set(['xls', 'xlsx', 'ods', 'csv', 'numbers'])],
  ['slides', /(ms-powerpoint|presentationml|opendocument\.presentation|apple\.keynote)/, new Set(['ppt', 'pptx', 'odp', 'key'])],
  ['archive', /(zip|x-7z|x-rar|vnd\.rar|gzip|x-tar|x-bzip)/, new Set(['zip', 'rar', '7z', 'gz', 'tgz', 'tar', 'bz2'])],
  ['audio', /^audio\//, new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'flac'])],
  ['image', /^image\//, new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg', 'bmp'])],
  ['video', /^video\//, new Set(['mp4', 'mov', 'webm', 'mkv', '3gp', 'm4v'])],
  ['text', /^(text\/|application\/(json|xml))/, new Set(['txt', 'md', 'json', 'xml', 'log', 'yaml', 'yml'])],
];

export function extensionOf(name: string): string {
  const found = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return found ? found[1].toUpperCase() : '';
}

export function wrappableName(name: string): string {
  return name.replace(/([_\-.])(?=.)/g, '$1\u200B');
}

export function fileFamily(name: string, mimetype: string): FileFamily {
  const mime = mimetype.toLowerCase();
  const extension = extensionOf(name).toLowerCase();
  const generic = !mime || mime === 'application/octet-stream';
  for (const [family, pattern] of families) if (!generic && pattern.test(mime)) return family;
  for (const [family, , extensions] of families) if (extensions.has(extension)) return family;
  return 'other';
}

export function mediaKind(attachment: Pick<Attachment, 'name' | 'mimetype'>): MediaKind {
  const mime = attachment.mimetype.toLowerCase();
  if (shownImages.has(mime)) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return fileFamily(attachment.name, attachment.mimetype) === 'pdf' ? 'pdf' : 'file';
}

export function isVisual(attachment: Pick<Attachment, 'name' | 'mimetype'>): boolean {
  const kind = mediaKind(attachment);
  return kind === 'image' || kind === 'video';
}

export const tileMax = { width: 260, height: 320 };
const ratioBounds = { tallest: 0.6, widest: 1.9 };

export function tileSize(media: { width?: number | null; height?: number | null }, maxWidth: number = tileMax.width): { width: number; height: number } {
  const width = Math.min(maxWidth, tileMax.width);
  const known = media.width && media.height && media.width > 0 && media.height > 0;
  const ratio = known ? Math.min(Math.max(media.width! / media.height!, ratioBounds.tallest), ratioBounds.widest) : 4 / 3;
  const height = Math.min(Math.round(width / ratio), tileMax.height);
  return { width: height === tileMax.height ? Math.round(height * ratio) : width, height };
}

export function clock(durationMs: number): string {
  const total = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
