export type Photo = { version: string; small: string; medium: string };

export type PhotoEntry = { photo: Photo | null; at: number };

const refreshAfterMs = 7 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLocalPath(value: unknown): value is string {
  return typeof value === 'string' && /^\/(?!\/)/.test(value);
}

export function photoFrom(value: unknown): Photo | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.version !== 'string' || !value.version || !isLocalPath(value.small)) return undefined;
  return { version: value.version, small: value.small, medium: isLocalPath(value.medium) ? value.medium : value.small };
}

function sameVersion(a: Photo | null, b: Photo | null): boolean {
  return a === null || b === null ? a === b : a.version === b.version;
}

export function settle(current: PhotoEntry | undefined, photo: Photo | null, now: number): PhotoEntry | null {
  if (current && sameVersion(current.photo, photo) && now - current.at < refreshAfterMs) return null;
  return { photo, at: now };
}

export function partnersInStore(store: unknown): (Record<string, unknown> & { id: number })[] {
  if (!isRecord(store)) return [];
  const raw = store['res.partner'];
  const partners: unknown[] = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return partners.filter((partner): partner is Record<string, unknown> & { id: number } => isRecord(partner) && typeof partner.id === 'number');
}

export function photosInStore(store: unknown): [number, Photo | null][] {
  const out: [number, Photo | null][] = [];
  for (const partner of partnersInStore(store)) {
    if (!('kaitech_mobile_photo' in partner)) continue;
    const photo = photoFrom(partner.kaitech_mobile_photo);
    if (photo !== undefined) out.push([partner.id, photo]);
  }
  return out;
}
