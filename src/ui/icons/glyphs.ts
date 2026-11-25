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
const pinParts = [body('M9 3h6l-1 5.5 3.5 3.5V14H6.5v-2L10 8.5Z'), line('M12 14v7')];
const archiveParts = [body(tile(3, 4, 21, 8.5, 1.5)), line('M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5')];
const peopleParts = [
  line(circle(9, 8, 3.5)),
  line('M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1'),
  line('M15.5 4.5a3.5 3.5 0 0 1 0 7'),
  line('M18 14.2a5 5 0 0 1 3 4.8v1'),
];
const faceParts = [body(circle(12, 12, 9)), cut('M8.5 14.5a4.5 4.5 0 0 0 7 0'), cutDot(`${circle(9, 10, 1.25)}${circle(15, 10, 1.25)}`)];
const starParts = [body('M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z')];
const bulbParts = [body('M9 17.5v-2.7A6.5 6.5 0 1 1 15 14.8v2.7Z'), line('M10 21h4')];

export const lockShackleDrop = 3.6;
export const trashLidHinge = { x: 20.5, y: 6 };

export const glyphs = {
  back: { parts: [line('M20 12H5'), line('M11 5l-7 7 7 7')] },
  forward: { parts: [line('M9 5l7 7-7 7')] },
  chevronDown: { parts: [line('M5 8.5l7 7 7-7')] },
  chevronUp: { parts: [line('M5 15.5l7-7 7 7')] },
  chevronLeft: { parts: [line('M15 5l-7 7 7 7')] },
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
  micResume: {
    parts: [body('M7.5 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0Z'), line('M4 11a6.5 6.5 0 0 0 13 0'), line('M10.5 17.5V21M7.5 21h6'), body(circle(19, 5.5, 1.25))],
  },
  phone: { parts: [body(handset)] },
  phoneEnd: { parts: [body(handset)], rotate: 135 },
  video: { parts: videoParts },
  videoOff: { parts: [...videoParts, fullSlash] },
  photo: { parts: [body(camera), cut(circle(12, 13, 3.5))] },
  camera: { parts: [body(camera), cut(circle(12, 13, 3.5)), cutDot(square(17.5, 9.5, 1.5))] },
  cameraFlip: { parts: [body(camera), cut('M8 11h7.5M13.5 9l2 2-2 2'), cut('M16 15H8.5M10.5 13l-2 2 2 2')] },
  speaker: {
    parts: [body('M4 9h3.5L12 5v14l-4.5-4H4Z'), line('M15.5 9.5a3.5 3.5 0 0 1 0 5'), line('M18 7a7 7 0 0 1 0 10')],
  },
  screenShare: { parts: [body(tile(3, 4, 21, 16)), line('M12 16v4M8 20h8'), cut('M12 13V8M9 10.5l3-3 3 3')] },
  pip: { parts: [body(tile(3, 5, 21, 19)), cutDot(tile(12, 12, 18, 16, 1))] },
  people: { parts: peopleParts },
  decision: { parts: [line('M12 21v-8L6 7M12 13l6-6'), line('M5 11V5h6M13 5h6v6')] },
  record: { parts: [line(circle(12, 12, 8)), dot(circle(12, 12, 4))] },
  image: { parts: [body(tile(3, 4, 21, 20)), cut('M3.5 17.5l5-5 5 5M12 16l2.5-2.5 6 6'), cutDot(circle(15.5, 8.5, 1.75))] },
  file: { parts: [body(page), cut(fold)] },
  audioFile: { parts: [body(page), cut(fold), cut('M11.5 17v-6.5l4 1.5'), cutDot(circle(10, 17, 1.75))] },
  location: { parts: [body('M12 21.5 6.8 14.2A7 7 0 1 1 17.2 14.2Z'), cut(circle(12, 9.5, 2.5))] },
  poll: { parts: [body(tile(3, 3, 21, 21)), cut('M8 17v-5M12 17V7M16 17v-8')] },
  contact: { parts: [body(circle(12, 8, 4)), body('M4.5 21v-1a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v1Z')] },
  doc: { parts: [body(page), cut(fold), cut('M8.5 12.5h7M8.5 16.5h4.5')] },
  minutes: { parts: [body(page), cut(fold), cut('M9 13v3M12 11v7M15 13v3')] },
  meeting: { parts: [body(tile(3, 5, 21, 21)), line('M8 3v4M16 3v4'), cut('M3 10h18'), cutDot(square(7, 13, 3))] },
  steps: { parts: [line('M9 6h12M9 12h12M9 18h12'), dot(square(3, 4.5, 3)), dot(square(3, 10.5, 3)), dot(square(3, 16.5, 3))] },
  more: { parts: [dot(square(3.5, 10.5, 3)), dot(square(10.5, 10.5, 3)), dot(square(17.5, 10.5, 3))] },
  copy: { parts: [body(tile(9, 9, 21, 21)), line('M15 6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v9h3')] },
  edit: { parts: [body('M4 20v-4L15 5l4 4L8 20Z'), cut('M12.5 7.5l4 4')] },
  pin: { parts: [body('M9 3h6l-1 6 4 4H6l4-4Z'), line('M12 13v8')] },
  star: { parts: starParts },
  favorite: { parts: starParts },
  link: { parts: [line('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'), line('M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1')] },
  task: { parts: [body(tile(3, 3, 21, 21)), cut('M7.5 12.5l3 3 6-6.5')] },
  calendar: { parts: [body(tile(3, 5, 21, 21)), cut('M3 10h18'), line('M8 2.5v4M16 2.5v4')] },
  backspace: { parts: [body('M8.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.5L2.5 12Z'), cut('M11 9.5l5 5M16 9.5l-5 5')] },
  keyboard: { parts: [body(tile(2.5, 6, 21.5, 18)), cutDot(`${square(5.5, 8.5, 2)}${square(9, 8.5, 2)}${square(12.5, 8.5, 2)}${square(16, 8.5, 2)}`), cut('M8 14.5h8')] },
  sticker: { parts: [body('M3 18V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8l-7 7H6a3 3 0 0 1-3-3Z'), cut('M14 21v-4a3 3 0 0 1 3-3h4'), cut('M8 12a4 4 0 0 0 4.5 1.5'), cutDot(`${circle(9, 8.5, 1.25)}${circle(14, 8.5, 1.25)}`)] },
  emoji: { parts: faceParts },
  gif: { parts: [body(tile(2, 5, 22, 19)), cut('M9.5 8.5h-4v7h4V12H8M12.5 8.5v7M19 8.5h-3.5v7M15.5 12H18')] },
  catSmileys: { parts: faceParts },
  catPeople: { parts: peopleParts },
  catNature: { parts: [body('M5 19C5 10.5 10.5 5 19 5c0 8.5-5.5 14-14 14Z'), cut('M8.5 15.5l6-6')] },
  catFood: {
    parts: [body('M4 10h12v4.5a5.5 5.5 0 0 1-5.5 5.5h-1A5.5 5.5 0 0 1 4 14.5Z'), line('M16 11.5h1.5a2.5 2.5 0 0 1 0 5H16'), line('M8 3.5v3M12 3.5v3')],
  },
  catTravel: {
    parts: [body('M3.5 18.5V13L6 6.5h12l2.5 6.5v5.5Z'), cut('M3.5 13h17'), cutDot(`${square(6.5, 14.75, 2)}${square(15.5, 14.75, 2)}`), dot('M5 18.5h3.5V21H5ZM15.5 18.5H19V21h-3.5Z')],
  },
  catActivities: { parts: [line(circle(12, 12, 9)), line('M6 4.9a9 9 0 0 1 0 14.2M18 4.9a9 9 0 0 0 0 14.2')] },
  catObjects: { parts: bulbParts },
  catSymbols: { parts: [line(circle(7.5, 7.5, 2.5)), line(circle(16.5, 16.5, 2.5)), line('M18.5 5.5l-13 13')] },
  unread: { parts: [body('M3 21V7a3 3 0 0 1 3-3h8v2a5 5 0 0 0 7 4.6V15a3 3 0 0 1-3 3H8Z'), dot(circle(19, 5, 3))] },
  globe: { parts: [line(circle(12, 12, 9)), line('M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18')] },
  forwardMessage: { parts: [line('M14 5l6 6-6 6'), line('M20 11H10a6 6 0 0 0-6 6v2')] },
  share: { parts: [line('M12 3v12'), line('M7.5 7.5 12 3l4.5 4.5'), line('M7 10H5v11h14V10h-2')] },
  sign: { parts: [body('M4 17v-3.5L13.5 4 17 7.5 7.5 17Z'), dot('M12 19h9v2h-9Z')] },
  trash: { parts: [line('M3 6h18M9 6V3h6v3'), line('M5.5 6 7 21h10l1.5-15'), line('M10 10.5v6M14 10.5v6')] },
  trashLid: { parts: [line('M3.5 6h17M9 6V3h6v3')] },
  trashBody: { parts: [body('M5.5 8.5h13L17 21H7Z'), cut('M10 11.5v6M14 11.5v6')] },
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
  bulb: { parts: bulbParts },
  compass: { parts: [body(circle(12, 12, 9)), cut('M15.5 8.5l-2 5-5 2 2-5Z')] },
  play: { parts: [body('M7 4.5v15L19 12Z')] },
  pause: { parts: [body(tile(6, 5, 10, 19, 1)), body(tile(14, 5, 18, 19, 1))] },
  stop: { parts: [body(tile(5, 5, 19, 19, 2))] },
  expand: { parts: [line('M14 4h6v6M10 20H4v-6'), line('M20 4l-6.5 6.5M4 20l6.5-6.5')] },
  external: { parts: [line('M14 4h6v6'), line('M20 4l-9 9'), line('M18 14v6H4V6h6')] },
  download: { parts: [line('M12 3v12'), line('M7.5 10.5 12 15l4.5-4.5'), line('M4 17v3h16v-3')] },
  filter: { parts: [body('M3 5h18l-7 8v6l-4 2v-8Z')] },
  lock: { parts: [body(tile(5, 10, 19, 21)), line('M8 10V7a4 4 0 0 1 8 0v3'), cutDot(square(11, 14.5, 2))] },
  lockOpen: { parts: [body(tile(5, 13, 19, 22, 2.5)), cutDot(square(11, 16.5, 2))] },
  lockShackle: { parts: [line('M9 10.4V5.4a3 3 0 0 1 6 0v5')] },
  arrowUp: { parts: [line('M12 20V5'), line('M5.5 11.5 12 5l6.5 6.5')] },
  arrowDown: { parts: [line('M12 4v15'), line('M5.5 12.5 12 19l6.5-6.5')] },
  minus: { parts: [line('M5 12h14')] },
  zoomIn: { parts: [line(circle(10.5, 10.5, 7)), line('M15.5 15.5 21 21'), line('M7.5 10.5h6M10.5 7.5v6')] },
  zoomOut: { parts: [line(circle(10.5, 10.5, 7)), line('M15.5 15.5 21 21'), line('M7.5 10.5h6')] },
  table: { parts: [body(tile(3, 4, 21, 20)), cut('M3 9.5h18M3 14.5h18M9 9.5V20')] },
  pinOff: { parts: [...pinParts, fullSlash] },
  archive: { parts: [...archiveParts, line('M10 12.5h4')] },
  unarchive: { parts: [...archiveParts, line('M12 17.5V12M9.5 14.5 12 12l2.5 2.5')] },
  leave: { parts: [line('M13 4H6v16h7'), line('M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5')] },
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
  return { strokeWidth: width, rotate: glyph.rotate ?? 0, masked: merge(masked), cutouts: merge(cutouts), over };
}

function merge(paints: Paint[]): Paint[] {
  const groups = new Map<string, Paint>();
  for (const p of paints) {
    const key = `${p.fill}|${p.stroke}|${p.width}`;
    const found = groups.get(key);
    if (found) found.d += p.d;
    else groups.set(key, { ...p });
  }
  return [...groups.values()];
}
