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

export function photosInStore(store: unknown): [number, Photo | null][] {
  if (!isRecord(store)) return [];
  const raw = store['res.partner'];
  const partners = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const out: [number, Photo | null][] = [];
  for (const partner of partners) {
    if (!isRecord(partner) || typeof partner.id !== 'number' || !('kaitech_mobile_photo' in partner)) continue;
    const photo = photoFrom(partner.kaitech_mobile_photo);
    if (photo !== undefined) out.push([partner.id, photo]);
  }
  return out;
}
