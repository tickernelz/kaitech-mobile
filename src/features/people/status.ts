import { partnersInStore } from './photo';

export const statusLimit = 80;

export function statusLength(text: string): number {
  return Array.from(text).length;
}

export function fitStatus(text: string): string {
  const points = Array.from(text);
  return points.length > statusLimit ? points.slice(0, statusLimit).join('') : text;
}

export function cleanStatus(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function statusFrom(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim() || null;
}

export function statusesInStore(store: unknown): [number, string | null][] {
  const out: [number, string | null][] = [];
  for (const partner of partnersInStore(store)) {
    if (!('kaitech_status_text' in partner)) continue;
    const status = statusFrom(partner.kaitech_status_text);
    if (status !== undefined) out.push([partner.id, status]);
  }
  return out;
}
