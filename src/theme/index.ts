import { useMemo } from 'react';
import { Platform, useColorScheme, type TextStyle } from 'react-native';
import { colorsFor, type Colors, type Scheme } from './tokens';

export { brandGradient, personColors, radius, space } from './tokens';
export type { Colors, Scheme } from './tokens';

export function useTheme(): { scheme: Scheme; colors: Colors } {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return useMemo(() => ({ scheme, colors: colorsFor(scheme) }), [scheme]);
}

const brandFaces = { '600': 'SemiBold', '700': 'Bold', '800': 'ExtraBold' } as const;

function brand(weight: keyof typeof brandFaces): TextStyle {
  return Platform.OS === 'ios'
    ? { fontFamily: `PlusJakartaSans-${brandFaces[weight]}` }
    : { fontFamily: 'Plus Jakarta Sans', fontWeight: weight };
}

export const type = {
  display: { ...brand('800'), fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { ...brand('700'), fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  callout: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} satisfies Record<string, TextStyle>;
