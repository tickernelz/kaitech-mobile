export const floorDb = -50;
export const waveformBuckets = 64;
export const levelsPerSecond = 10;

export function levelOf(db: number | null | undefined): number {
  if (db === null || db === undefined || !Number.isFinite(db)) return 0;
  const linear = Math.min(1, Math.max(0, (db - floorDb) / -floorDb));
  return linear ** 0.8;
}

export function bucketsOf(values: number[], count: number): number[] {
  if (count <= 0) return [];
  if (!values.length) return new Array<number>(count).fill(0);
  const out: number[] = [];
  for (let index = 0; index < count; index++) {
    const start = Math.floor((index * values.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * values.length) / count));
    let peak = 0;
    for (let at = start; at < Math.min(end, values.length); at++) peak = Math.max(peak, values[at]);
    out.push(peak);
  }
  return out;
}

export function waveformOf(levels: number[]): number[] {
  return bucketsOf(levels, waveformBuckets).map((level) => Math.round(Math.min(1, Math.max(0, level)) * 255));
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Of(bytes: number[]): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] & 255;
    const b = index + 1 < bytes.length ? bytes[index + 1] & 255 : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] & 255 : 0;
    const chunk = (a << 16) | (b << 8) | c;
    out += alphabet[(chunk >> 18) & 63] + alphabet[(chunk >> 12) & 63];
    out += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : '=';
    out += index + 2 < bytes.length ? alphabet[chunk & 63] : '=';
  }
  return out;
}
