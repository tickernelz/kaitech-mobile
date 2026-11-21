import type { PatternName } from './motifs';

export type Point = readonly [number, number];
export type Stop = readonly [offset: number, color: string];

export type Field = { kind: 'solid'; color: string } | { kind: 'linear'; from: Point; to: Point; stops: readonly Stop[] };

export type Look = {
  field: Field;
  pattern?: { name: PatternName; color: string; accent?: string; opacity: number };
  scrim?: { color: string; opacity: number };
  ink: string;
};

export type WallpaperKind = 'pattern' | 'gradient' | 'solid' | 'dark';

const ids = ['doodle', 'keylines', 'bars', 'monogram', 'kaitech', 'dusk', 'mist', 'lavender', 'slate', 'blush', 'midnight', 'ink'] as const;

export type WallpaperId = (typeof ids)[number];

export type Wallpaper = { id: WallpaperId; kind: WallpaperKind; nameKey: `appearance.wallpapers.${WallpaperId}`; light: Look; dark: Look };

const diagonal = { from: [0, 0], to: [1, 1] } as const;
const vertical = { from: [0, 0], to: [0, 1] } as const;
const lightInk = '#11051B';
const darkInk = '#F0EDF4';

function solid(color: string): Field {
  return { kind: 'solid', color };
}

function wallpaper(id: WallpaperId, kind: WallpaperKind, light: Look, dark: Look = light): Wallpaper {
  return { id, kind, nameKey: `appearance.wallpapers.${id}`, light, dark };
}

export const wallpapers: readonly Wallpaper[] = [
  wallpaper(
    'doodle',
    'pattern',
    { field: solid('#DAD1E6'), pattern: { name: 'doodle', color: '#441D65', accent: '#C2374A', opacity: 0.22 }, ink: lightInk },
    { field: solid('#040207'), pattern: { name: 'doodle', color: '#B18BD3', accent: '#FF7A7A', opacity: 0.22 }, ink: darkInk },
  ),
  wallpaper(
    'keylines',
    'pattern',
    { field: solid('#D5D8E6'), pattern: { name: 'keylines', color: '#2E2A6B', accent: '#C2374A', opacity: 0.16 }, ink: lightInk },
    { field: solid('#423A5E'), pattern: { name: 'keylines', color: '#D9CCF0', accent: '#FF8A8A', opacity: 0.16 }, ink: darkInk },
  ),
  wallpaper(
    'bars',
    'pattern',
    { field: solid('#E2CFD8'), pattern: { name: 'bars', color: '#441D65', accent: '#FF5A5A', opacity: 0.2 }, ink: lightInk },
    { field: solid('#000000'), pattern: { name: 'bars', color: '#8A5BB8', accent: '#FF5A5A', opacity: 0.26 }, ink: darkInk },
  ),
  wallpaper(
    'monogram',
    'pattern',
    { field: solid('#D3CCE3'), pattern: { name: 'monogram', color: '#441D65', accent: '#C2374A', opacity: 0.18 }, ink: lightInk },
    { field: solid('#4A3963'), pattern: { name: 'monogram', color: '#E4D6F7', accent: '#FFA0A0', opacity: 0.16 }, ink: darkInk },
  ),
  wallpaper(
    'kaitech',
    'gradient',
    { field: { kind: 'linear', ...diagonal, stops: [[0, '#441D65'], [1, '#FF5A5A']] }, scrim: { color: '#000000', opacity: 0.2 }, ink: '#FFFFFF' },
    { field: { kind: 'linear', ...diagonal, stops: [[0, '#7A45A8'], [1, '#FF5A5A']] }, scrim: { color: '#000000', opacity: 0.22 }, ink: '#FFFFFF' },
  ),
  wallpaper(
    'dusk',
    'gradient',
    { field: { kind: 'linear', ...vertical, stops: [[0, '#9A80BE'], [1, '#E8999C']] }, ink: lightInk },
    { field: { kind: 'linear', ...vertical, stops: [[0, '#4E3270'], [1, '#7A3A4E']] }, ink: darkInk },
  ),
  wallpaper(
    'mist',
    'gradient',
    { field: { kind: 'linear', ...diagonal, stops: [[0, '#CCC9EA'], [1, '#C4D6E6']] }, ink: lightInk },
    { field: { kind: 'linear', ...diagonal, stops: [[0, '#433D66'], [1, '#2F4A5E']] }, ink: darkInk },
  ),
  wallpaper('lavender', 'solid', { field: solid('#D8CDE8'), ink: lightInk }, { field: solid('#46395D'), ink: darkInk }),
  wallpaper('slate', 'solid', { field: solid('#D0D4DD'), ink: lightInk }, { field: solid('#3B414E'), ink: darkInk }),
  wallpaper('blush', 'solid', { field: solid('#EACCCC'), ink: lightInk }, { field: solid('#583A42'), ink: darkInk }),
  wallpaper('midnight', 'dark', { field: solid('#000000'), ink: darkInk }),
  wallpaper('ink', 'dark', { field: solid('#050308'), pattern: { name: 'keylines', color: '#B18BD3', opacity: 0.14 }, ink: darkInk }),
];

export const wallpaperIds: readonly WallpaperId[] = ids;

export const defaultWallpaperId: WallpaperId = 'doodle';

export function isWallpaperId(value: unknown): value is WallpaperId {
  return typeof value === 'string' && (ids as readonly string[]).includes(value);
}

export function wallpaperById(id: WallpaperId): Wallpaper {
  return wallpapers.find((entry) => entry.id === id) as Wallpaper;
}
