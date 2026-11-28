import { useMemo } from 'react';
import { Platform, useColorScheme, type TextStyle } from 'react-native';
import { materialColors, type MaterialColors } from './material';
import { colorsFor, type Colors, type Scheme } from './tokens';

export { avatarFill, blend, brandGradient, contrast, radius, space } from './tokens';
export type { Colors, Scheme } from './tokens';
export { materialColors, seedColor, type MaterialColors, type MaterialRole } from './material';

export function useTheme(): { scheme: Scheme; colors: Colors; material: MaterialColors } {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return useMemo(() => ({ scheme, colors: colorsFor(scheme), material: materialColors(scheme) }), [scheme]);
}

const brandFaces = { '600': 'SemiBold', '700': 'Bold', '800': 'ExtraBold' } as const;

function brand(weight: keyof typeof brandFaces): TextStyle {
  return Platform.OS === 'ios'
    ? { fontFamily: `PlusJakartaSans-${brandFaces[weight]}` }
    : { fontFamily: 'Plus Jakarta Sans', fontWeight: weight };
}

const kaitechType = {
  display: { ...brand('800'), fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { ...brand('700'), fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  callout: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} satisfies Record<string, TextStyle>;

const materialType = {
  display: { ...brand('800'), fontSize: 32, lineHeight: 40, letterSpacing: -0.4 },
  title: { ...brand('700'), fontSize: 22, lineHeight: 28, letterSpacing: 0 },
  headline: { fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0.15 },
  body: { fontSize: 16, lineHeight: 24, letterSpacing: 0.5 },
  callout: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25 },
  footnote: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
} satisfies Record<keyof typeof kaitechType, TextStyle>;

export const type = Platform.OS === 'android' ? materialType : kaitechType;
