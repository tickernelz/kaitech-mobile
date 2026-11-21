export type Glyph = { d: string; fill?: boolean };

export const glyphs = {
  bubble: { d: 'M4 19V7A2 2 0 0 1 6 5H18A2 2 0 0 1 20 7V14A2 2 0 0 1 18 16H8Z' },
  mic: { d: 'M9 6A3 3 0 0 1 15 6V11A3 3 0 0 1 9 11ZM6 11A6 6 0 0 0 18 11M12 17V20M9 20H15' },
  monogram: { d: 'M6 4V20M15 4L9 11M10.5 9.5L16 20M19 20H21' },
  camera: { d: 'M3 8A2 2 0 0 1 5 6H13A2 2 0 0 1 15 8V16A2 2 0 0 1 13 18H5A2 2 0 0 1 3 16ZM15 10.5L21 7V17L15 13.5' },
  clip: { d: 'M16 8V15A4 4 0 0 1 8 15V6A2.5 2.5 0 0 1 13 6V15A1 1 0 0 1 11 15V8' },
  spark: { d: 'M12 4Q13 11 20 12Q13 13 12 20Q11 13 4 12Q11 11 12 4Z' },
  wave: { d: 'M4 10V14M8 7V17M12 9V15M16 5V19M20 10V14' },
  page: { d: 'M6 3H14L19 8V21H6ZM14 3V8H19' },
  checks: { d: 'M3 13L7 17L15 8M11 16L12 17L20 8' },
  ring: { d: 'M12 7A5 5 0 1 1 12 17A5 5 0 1 1 12 7Z' },
  bar: { d: 'M5 10H19V14H5Z', fill: true },
} satisfies Record<string, Glyph>;

export type GlyphName = keyof typeof glyphs;

export type Placement = { glyph: GlyphName; x: number; y: number; size: number; rotate: number; accent?: boolean };

export type Tile = { width: number; height: number; stroke: number; marks: Placement[]; grid?: { step: number; stroke: number } };

export type PatternName = 'doodle' | 'keylines' | 'bars' | 'monogram';

export const glyphBox = 24;

export const tiles: Record<PatternName, Tile> = {
  doodle: {
    width: 216,
    height: 216,
    stroke: 1.5,
    marks: [
      { glyph: 'bubble', x: 30, y: 30, size: 26, rotate: -12 },
      { glyph: 'spark', x: 92, y: 24, size: 18, rotate: 0, accent: true },
      { glyph: 'mic', x: 152, y: 34, size: 24, rotate: 14 },
      { glyph: 'ring', x: 196, y: 92, size: 14, rotate: 0 },
      { glyph: 'monogram', x: 62, y: 86, size: 26, rotate: 0 },
      { glyph: 'clip', x: 124, y: 92, size: 24, rotate: 28 },
      { glyph: 'bar', x: 24, y: 128, size: 18, rotate: -30, accent: true },
      { glyph: 'camera', x: 176, y: 150, size: 24, rotate: -8 },
      { glyph: 'wave', x: 88, y: 148, size: 24, rotate: 0 },
      { glyph: 'page', x: 36, y: 186, size: 24, rotate: 10 },
      { glyph: 'checks', x: 132, y: 194, size: 22, rotate: -6 },
      { glyph: 'spark', x: 196, y: 198, size: 12, rotate: 0, accent: true },
    ],
  },
  keylines: {
    width: 48,
    height: 48,
    stroke: 1,
    grid: { step: 24, stroke: 0.75 },
    marks: [
      { glyph: 'ring', x: 12, y: 12, size: 7, rotate: 0 },
      { glyph: 'ring', x: 36, y: 36, size: 7, rotate: 0, accent: true },
    ],
  },
  bars: {
    width: 132,
    height: 132,
    stroke: 1.5,
    marks: [
      { glyph: 'bar', x: 24, y: 24, size: 26, rotate: -30 },
      { glyph: 'bar', x: 90, y: 40, size: 20, rotate: -30, accent: true },
      { glyph: 'bar', x: 52, y: 82, size: 22, rotate: -30, accent: true },
      { glyph: 'bar', x: 110, y: 104, size: 26, rotate: -30 },
      { glyph: 'bar', x: 22, y: 116, size: 16, rotate: -30 },
    ],
  },
  monogram: {
    width: 112,
    height: 96,
    stroke: 1.5,
    marks: [
      { glyph: 'monogram', x: 28, y: 24, size: 24, rotate: 0 },
      { glyph: 'monogram', x: 84, y: 72, size: 24, rotate: 0, accent: true },
    ],
  },
};
