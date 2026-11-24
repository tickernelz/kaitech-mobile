import { seedPalettes } from './materialSeed';
import { colorsFor, type Scheme } from './tokens';

export { seedColor } from './materialSeed';

export type MaterialRole = keyof (typeof seedPalettes)['light'];
export type MaterialColors = Record<MaterialRole, `#${string}`>;

function rolesFor(scheme: Scheme): MaterialColors {
  const c = colorsFor(scheme);
  const dark = scheme === 'dark';
  return {
    ...seedPalettes[scheme],
    primary: c.primary,
    onPrimary: c.onPrimary,
    surfaceTint: c.primary,
    secondaryContainer: c.select,
    onSecondaryContainer: c.selectInk,
    background: c.canvas,
    onBackground: c.ink,
    surface: c.surface,
    onSurface: c.ink,
    surfaceVariant: c.surface2,
    onSurfaceVariant: c.inkSoft,
    surfaceBright: c.surface,
    surfaceDim: c.canvas,
    surfaceContainerLowest: dark ? c.canvas : c.surface,
    surfaceContainerLow: dark ? c.surface : c.canvas,
    surfaceContainer: dark ? c.surface : c.surface2,
    surfaceContainerHigh: c.surface2,
    surfaceContainerHighest: c.line,
    inverseSurface: c.ink,
    inverseOnSurface: c.canvas,
    error: c.dangerInk,
    onError: dark ? c.canvas : c.onPrimary,
    errorContainer: c.dangerBand,
    onErrorContainer: c.dangerInk,
    outline: c.edge,
    outlineVariant: c.line,
  } as MaterialColors;
}

const roles = { light: rolesFor('light'), dark: rolesFor('dark') };

export function materialColors(scheme: Scheme): MaterialColors {
  return roles[scheme];
}
