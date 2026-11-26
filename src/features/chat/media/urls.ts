import { attachmentUrl } from '../odoo';
import type { Attachment } from '../types';

function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function imageUrl(origin: string, attachment: Attachment, width: number): string {
  const size = Math.max(64, Math.min(2048, Math.round(width)));
  return `${origin}/web/image/${attachment.id}/${size}x0${query({ access_token: attachment.accessToken, unique: attachment.checksum })}`;
}

export function serverPdfThumbnail(origin: string, attachment: Attachment): string | null {
  const thumbnail = attachment.media?.thumbnail;
  if (!thumbnail) return null;
  return `${origin}/web/image/ir.attachment/${attachment.id}/thumbnail${query({ access_token: thumbnail.token, unique: attachment.checksum })}`;
}

export function streamUrl(origin: string, attachment: Attachment): string {
  return attachmentUrl(origin, attachment);
}

export function downloadUrl(origin: string, attachment: Attachment): string {
  return attachmentUrl(origin, attachment, { download: true, token: false });
}
