export type Scheme = 'light' | 'dark';

const pairs = {
  canvas: ['#F4F4F5', '#100F11'],
  surface: ['#FFFFFF', '#1C1B1F'],
  surface2: ['#EFEFF1', '#28272B'],
  line: ['#E2E1E5', '#343238'],
  lineStrong: ['#C6C5CA', '#4A4850'],
  edge: ['#7F7D85', '#85838B'],
  ink: ['#151418', '#F1F0F3'],
  inkSoft: ['#55535B', '#B6B4BB'],
  inkFaint: ['#67656D', '#95939B'],
  primary: ['#441D65', '#9358C7'],
  primaryPressed: ['#2F1447', '#7A4DB8'],
  onPrimary: ['#FFFFFF', '#FFFFFF'],
  select: ['#EDE7F5', '#2D2739'],
  selectInk: ['#2B1542', '#EEE9F6'],
  focus: ['#7A4DB0', '#A889DC'],
  link: ['#5F2E91', '#C4A8EE'],
  ok: ['#2A9754', '#4DBF74'],
  okInk: ['#0D6332', '#7FDC9A'],
  okBand: ['#DCF7E2', '#15291B'],
  warnInk: ['#7D4A07', '#FAC871'],
  warnBand: ['#FFEECB', '#33260F'],
  danger: ['#E5383B', '#F75D59'],
  dangerInk: ['#B91C1E', '#FF9E96'],
  dangerBand: ['#FFE7E6', '#3D1C1B'],
  infoInk: ['#225899', '#9DC7FE'],
  infoBand: ['#E4F0FF', '#16273A'],
  wordmark: ['#200C30', '#F1F0F3'],
  scrim: ['#00000073', '#0000009E'],
  stage: ['#000000', '#000000'],
  onStage: ['#FFFFFF', '#FFFFFF'],
  stageScrim: ['#0000008C', '#0000008C'],
} as const;

export type ColorName = keyof typeof pairs;
export type Colors = Record<ColorName, string>;

export const brandGradient = ['#441D65', '#FF5A5A'] as const;

export function colorsFor(scheme: Scheme): Colors {
  const index = scheme === 'dark' ? 1 : 0;
  return Object.fromEntries(Object.entries(pairs).map(([name, pair]) => [name, pair[index]])) as Colors;
}

const people = [
  { name: ['#68680F', '#9E9E21'], fill: '#787823' },
  { name: ['#397210', '#5CAB24'], fill: '#4C8226' },
  { name: ['#10725F', '#24AC91'], fill: '#268370' },
  { name: ['#126E81', '#29A7C0'], fill: '#2A7F90' },
  { name: ['#4B50E5', '#8E91E7'], fill: '#6669D2' },
  { name: ['#7241E4', '#A589E6'], fill: '#8260D1' },
  { name: ['#9E1ED5', '#C47CE3'], fill: '#A54DCB' },
  { name: ['#B31AA4', '#E06DD4'], fill: '#C238B5' },
  { name: ['#BF1B6D', '#E274AB'], fill: '#C84185' },
] as const;

export const personCount = people.length;

export function personColors(seed: number, scheme: Scheme): { name: string; fill: string } {
  const person = people[Math.abs(Math.trunc(seed)) % people.length];
  return { name: person.name[scheme === 'dark' ? 1 : 0], fill: person.fill };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 } as const;

export const radius = { sm: 6, md: 10, card: 16, field: 14, sheet: 28, pill: 999 } as const;

export const selectionBar = 4;
