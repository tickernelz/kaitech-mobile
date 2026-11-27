import type { BlurTint } from 'expo-blur';
import { Platform } from 'react-native';
import { materialColors } from '../theme/material';
import { colorsFor, type Scheme } from '../theme/tokens';

export type Thickness = 'regular' | 'thick';

export type GlassMaterial = { tint: string; edge: string; sheen: string; well: string; shadow: string; blur: BlurTint };

const body: Record<Thickness, Record<Scheme, string>> = { regular: { light: 'EB', dark: 'CC' }, thick: { light: 'F7', dark: 'EB' } };
const sheen: Record<Scheme, string> = { light: 'CC', dark: '24' };
const well: Record<Scheme, string> = { light: '99', dark: '1F' };
const shadow: Record<Scheme, string> = { light: '2E', dark: '73' };

export function glassMaterial(scheme: Scheme, thickness: Thickness = 'regular', os: typeof Platform.OS = Platform.OS): GlassMaterial {
  const colors = colorsFor(scheme);
  const material = materialColors(scheme);
  const android = os === 'android';
  const white = colorsFor('light').surface;
  return {
    tint: `${android ? material.surfaceContainerHighest : colors.glass}${body[thickness][scheme]}`,
    edge: android ? material.outlineVariant : colors.lineStrong,
    sheen: `${white}${sheen[scheme]}`,
    well: `${white}${well[scheme]}`,
    shadow: `0px 6px 20px -4px ${colors.stage}${shadow[scheme]}`,
    blur: scheme === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight',
  };
}
