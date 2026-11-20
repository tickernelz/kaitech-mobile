export type Scheme = 'light' | 'dark';

const pairs = {
  canvas: ['#FAF9FC', '#110B18'],
  surface: ['#FFFFFF', '#1B1323'],
  surface2: ['#F5F3F8', '#241C2E'],
  line: ['#E3E0E7', '#342C3F'],
  lineStrong: ['#C6C2CC', '#4D4259'],
  edge: ['#837D8B', '#7E7689'],
  ink: ['#11051B', '#F0EDF4'],
  inkSoft: ['#5C5466', '#B5ADC1'],
  inkFaint: ['#716C79', '#968EA1'],
  primary: ['#441D65', '#B18BD3'],
  primaryPressed: ['#4C276E', '#C6A7EB'],
  onPrimary: ['#FFFFFF', '#11051B'],
  select: ['#F0E7FC', '#36244A'],
  selectInk: ['#472268', '#E7D5FF'],
  focus: ['#8959BA', '#BC97E8'],
  link: ['#692E9B', '#CDAEF2'],
  ok: ['#2A9754', '#4DBF74'],
  okInk: ['#0D6332', '#7FDC9A'],
  okBand: ['#DCF7E2', '#14301C'],
  warnInk: ['#7D4A07', '#FAC871'],
  warnBand: ['#FFEECB', '#3A270B'],
  danger: ['#EF4445', '#F75D59'],
  dangerInk: ['#B91C1E', '#FF9E96'],
  dangerBand: ['#FFE7E6', '#481B19'],
  infoInk: ['#225899', '#9DC7FE'],
  infoBand: ['#E4F0FF', '#172A41'],
  wordmark: ['#200C30', '#F0EDF4'],
} as const;

export type ColorName = keyof typeof pairs;
export type Colors = Record<ColorName, string>;

export const brandGradient = ['#441D65', '#FF5A5A'] as const;

export function colorsFor(scheme: Scheme): Colors {
  const index = scheme === 'dark' ? 1 : 0;
  return Object.fromEntries(Object.entries(pairs).map(([name, pair]) => [name, pair[index]])) as Colors;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 } as const;

export const radius = { sm: 6, md: 10, card: 16, field: 14, sheet: 28, pill: 999 } as const;
