import { Platform } from 'react-native';

export type Scheme = 'light' | 'dark';

const accents = {
  android: {
    primary: ['#705289', '#DDB9F8'],
    primaryPressed: ['#7E6395', '#CDAAE8'],
    onPrimary: ['#FFFFFF', '#3F2358'],
    onDanger: ['#FFFFFF', '#100F11'],
  },
  ios: {
    primary: ['#441D65', '#9358C7'],
    primaryPressed: ['#2F1447', '#7A4DB8'],
    onPrimary: ['#FFFFFF', '#FFFFFF'],
    onDanger: ['#FFFFFF', '#FFFFFF'],
  },
} as const;

const pairs = {
  canvas: ['#F4F4F5', '#100F11'],
  surface: ['#FFFFFF', '#1C1B1F'],
  surface2: ['#EFEFF1', '#28272B'],
  glass: ['#D5D1DF', '#343238'],
  line: ['#E2E1E5', '#343238'],
  lineStrong: ['#C6C5CA', '#4A4850'],
  edge: ['#7F7D85', '#85838B'],
  ink: ['#151418', '#F1F0F3'],
  inkSoft: ['#55535B', '#B6B4BB'],
  inkFaint: ['#67656D', '#95939B'],
  ...accents[Platform.OS === 'android' ? 'android' : 'ios'],
  onFill: ['#FFFFFF', '#FFFFFF'],
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

export const avatarFills = ['#8E565F', '#3A775E', '#27767A', '#426D91', '#646393', '#7F5A81'] as const;

export function avatarFill(seed: number): string {
  return avatarFills[Math.abs(Math.trunc(seed)) % avatarFills.length];
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 } as const;

export const radius =
  Platform.OS === 'android' ? ({ sm: 8, md: 12, card: 16, field: 14, sheet: 28, pill: 999 } as const) : ({ sm: 6, md: 10, card: 16, field: 14, sheet: 28, pill: 999 } as const);
