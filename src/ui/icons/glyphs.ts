export type Role = 'body' | 'cut' | 'line' | 'dot' | 'cutDot' | 'slash';
export type Part = { d: string; role: Role };
export type Glyph = { parts: Part[]; rotate?: number };
export type IconVariant = 'line' | 'fill';

const body = (d: string): Part => ({ d, role: 'body' });
const cut = (d: string): Part => ({ d, role: 'cut' });
const line = (d: string): Part => ({ d, role: 'line' });
const dot = (d: string): Part => ({ d, role: 'dot' });
const cutDot = (d: string): Part => ({ d, role: 'cutDot' });
const slash = (d: string): Part => ({ d, role: 'slash' });

function tile(x1: number, y1: number, x2: number, y2: number, r = 3): string {
  return `M${x1} ${y2}V${y1 + r}A${r} ${r} 0 0 1 ${x1 + r} ${y1}H${x2 - r}A${r} ${r} 0 0 1 ${x2} ${y1 + r}V${y2 - r}A${r} ${r} 0 0 1 ${x2 - r} ${y2}Z`;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

function square(x: number, y: number, side: number): string {
  return `M${x} ${y}h${side}v${side}h${-side}Z`;
}

const bubble = 'M3 21V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8Z';
const page = 'M5 21V6a3 3 0 0 1 3-3h6l5 5v10a3 3 0 0 1-3 3Z';
const fold = 'M14 3v5h5';
const micParts = [
  body('M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0Z'),
  line('M5.5 11a6.5 6.5 0 0 0 13 0'),
  line('M12 17.5V21'),
  line('M9 21h6'),
];
const videoParts = [body(tile(3, 6, 15.5, 18)), body('M15.5 10.5 21 7.5v9l-5.5-3Z')];
const camera = 'M3 19V10a3 3 0 0 1 3-3h1.5l2-3h5l2 3H18a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3Z';
const cloud = 'M7 19a4.5 4.5 0 0 1-.9-8.9A6 6 0 0 1 17.8 9.2 5 5 0 0 1 17 19Z';
const bell = [body('M5 17h14l-1.5-2.5V10a5.5 5.5 0 0 0-11 0v4.5Z'), line('M10 20.5h4')];
const handset = 'M4 5.5 6.5 3l4 4L8 9.5l6.5 6.5 2.5-2.5 4 4-2.5 2.5A14.5 14.5 0 0 1 4 5.5Z';
const fullSlash = slash('M3 3l18 18');

export const glyphs = {
  back: { parts: [line('M20 12H5'), line('M11 5l-7 7 7 7')] },
  forward: { parts: [line('M9 5l7 7-7 7')] },
  chevronDown: { parts: [line('M5 8.5l7 7 7-7')] },
  close: { parts: [line('M5 5l14 14M19 5 5 19')] },
  search: { parts: [line(circle(10.5, 10.5, 7)), line('M15.5 15.5 21 21')] },
  history: { parts: [line('M5.5 8.25A7.5 7.5 0 1 0 12 4.5'), dot('M12 2 8.5 4.5 12 7Z'), line('M12 8.5V12l2.5 2.5')] },
  chat: { parts: [body(bubble)] },
  thread: { parts: [body(bubble), cut('M7.5 9h9M7.5 13h5.5')] },
  reply: { parts: [line('M9 5 3 11l6 6'), line('M4 11h9a7 7 0 0 1 7 7v2')] },
  send: { parts: [body('M3 4l16.5 8L3 20l3.5-8Z'), cut('M6.5 12H12')] },
  attach: { parts: [line('M16.5 7.5V16a4.5 4.5 0 0 1-9 0V6a3 3 0 0 1 6 0v9.5a1.5 1.5 0 0 1-3 0V8')] },
  mic: { parts: micParts },
  micOff: { parts: [...micParts, fullSlash] },
  phone: { parts: [body(handset)] },
  phoneEnd: { parts: [body(handset)], rotate: 135 },
  video: { parts: videoParts },
  videoOff: { parts: [...videoParts, fullSlash] },
  photo: { parts: [body(camera), cut(circle(12, 13, 3.5))] },
  cameraFlip: { parts: [body(camera), cut('M8 11h7.5M13.5 9l2 2-2 2'), cut('M16 15H8.5M10.5 13l-2 2 2 2')] },
  speaker: {
    parts: [body('M4 9h3.5L12 5v14l-4.5-4H4Z'), line('M15.5 9.5a3.5 3.5 0 0 1 0 5'), line('M18 7a7 7 0 0 1 0 10')],
  },
  screenShare: { parts: [body(tile(3, 4, 21, 16)), line('M12 16v4M8 20h8'), cut('M12 13V8M9 10.5l3-3 3 3')] },
  pip: { parts: [body(tile(3, 5, 21, 19)), cutDot(tile(12, 12, 18, 16, 1))] },
  people: {
    parts: [
      line(circle(9, 8, 3.5)),
      line('M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1'),
      line('M15.5 4.5a3.5 3.5 0 0 1 0 7'),
      line('M18 14.2a5 5 0 0 1 3 4.8v1'),
    ],
  },
  decision: { parts: [line('M12 21v-8L6 7M12 13l6-6'), line('M5 11V5h6M13 5h6v6')] },
  record: { parts: [line(circle(12, 12, 8)), dot(circle(12, 12, 4))] },
  image: { parts: [body(tile(3, 4, 21, 20)), cut('M3.5 17.5l5-5 5 5M12 16l2.5-2.5 6 6'), cutDot(circle(15.5, 8.5, 1.75))] },
  file: { parts: [body(page), cut(fold)] },
  doc: { parts: [body(page), cut(fold), cut('M8.5 12.5h7M8.5 16.5h4.5')] },
  minutes: { parts: [body(page), cut(fold), cut('M9 13v3M12 11v7M15 13v3')] },
  meeting: { parts: [body(tile(3, 5, 21, 21)), line('M8 3v4M16 3v4'), cut('M3 10h18'), cutDot(square(7, 13, 3))] },
  steps: { parts: [line('M9 6h12M9 12h12M9 18h12'), dot(square(3, 4.5, 3)), dot(square(3, 10.5, 3)), dot(square(3, 16.5, 3))] },
  copy: { parts: [body(tile(9, 9, 21, 21)), line('M15 6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v9h3')] },
  share: { parts: [line('M12 3v12'), line('M7.5 7.5 12 3l4.5 4.5'), line('M7 10H5v11h14V10h-2')] },
  sign: { parts: [body('M4 17v-3.5L13.5 4 17 7.5 7.5 17Z'), dot('M12 19h9v2h-9Z')] },
  trash: { parts: [line('M3 6h18M9 6V3h6v3'), line('M5.5 6 7 21h10l1.5-15'), line('M10 10.5v6M14 10.5v6')] },
  flag: { parts: [line('M5 3v18'), body('M5 4h14l-3.5 4.5L19 13H5Z')] },
  wave: { parts: [line('M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4')] },
  cloudUpload: { parts: [body(cloud), cut('M12 17v-5.5M9.5 14l2.5-2.5 2.5 2.5')] },
  cloudOff: { parts: [line(cloud), fullSlash] },
  check: { parts: [line('M4 12.5l5 5L20 6.5')] },
  checkDouble: { parts: [line('M2 12.5l5 5L16.5 8'), line('M10.5 16.5l1 1L21 8')] },
  clock: { parts: [body(circle(12, 12, 9)), cut('M12 7v5l3.5 3.5')] },
  alert: { parts: [body(circle(12, 12, 9)), cut('M12 7v6.5'), cutDot(square(11, 15.5, 2))] },
  eye: { parts: [body('M2.5 12C5 7.5 8.2 5.5 12 5.5s7 2 9.5 6.5c-2.5 4.5-5.7 6.5-9.5 6.5S5 16.5 2.5 12Z'), cut(circle(12, 12, 3))] },
  bell: { parts: bell },
  bellOff: { parts: [...bell, fullSlash] },
  retry: { parts: [line('M18.5 8.25A7.5 7.5 0 1 1 12 4.5'), dot('M12 2l3.5 2.5L12 7Z')] },
  hash: { parts: [line('M9 3v18M15 3v18M3 9h18M3 15h18')] },
  sparkle: { parts: [body('M12 3c0 5 4 9 9 9-5 0-9 4-9 9 0-5-4-9-9-9 5 0 9-4 9-9Z')] },
  bulb: { parts: [body('M9 17.5v-2.7A6.5 6.5 0 1 1 15 14.8v2.7Z'), line('M10 21h4')] },
  compass: { parts: [body(circle(12, 12, 9)), cut('M15.5 8.5l-2 5-5 2 2-5Z')] },
  play: { parts: [body('M7 4.5v15L19 12Z')] },
  pause: { parts: [body(tile(6, 5, 10, 19, 1)), body(tile(14, 5, 18, 19, 1))] },
  stop: { parts: [body(tile(5, 5, 19, 19, 2))] },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof glyphs;

export const iconNames = Object.keys(glyphs) as IconName[];

export type Paint = { d: string; fill: boolean; stroke: boolean; width: number };

export type Plan = { strokeWidth: number; rotate: number; masked: Paint[]; cutouts: Paint[]; over: Paint[] };

export function strokeFor(size: number): number {
  if (size <= 16) return 2.25;
  if (size <= 20) return 2.1;
  if (size <= 28) return 2;
  return 1.75;
}

export function plan(name: IconName, variant: IconVariant, size: number): Plan {
  const glyph: Glyph = glyphs[name];
  const width = strokeFor(size);
  const solid = variant === 'fill';
  const masked: Paint[] = [];
  const cutouts: Paint[] = [];
  const over: Paint[] = [];
  for (const { d, role } of glyph.parts) {
    if (role === 'slash') {
      over.push({ d, fill: false, stroke: true, width });
      cutouts.push({ d, fill: false, stroke: true, width: width * 2.8 });
    } else if (role === 'body') {
      masked.push({ d, fill: solid, stroke: true, width });
    } else if (role === 'cut' && solid) {
      cutouts.push({ d, fill: false, stroke: true, width });
    } else if (role === 'cutDot' && solid) {
      cutouts.push({ d, fill: true, stroke: false, width });
    } else {
      const filled = role === 'dot' || role === 'cutDot';
      masked.push({ d, fill: filled, stroke: !filled, width });
    }
  }
  return { strokeWidth: width, rotate: glyph.rotate ?? 0, masked, cutouts, over };
}
