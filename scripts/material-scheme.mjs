#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hct, MaterialDynamicColors, SchemeTonalSpot, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

const seed = '#441D65';
const roles = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'surfaceTint',
  'inverseSurface', 'inverseOnSurface', 'error', 'onError', 'errorContainer', 'onErrorContainer',
  'outline', 'outlineVariant', 'scrim', 'surfaceBright', 'surfaceDim',
  'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest', 'surfaceContainerLow', 'surfaceContainerLowest',
  'primaryFixed', 'primaryFixedDim', 'onPrimaryFixed', 'onPrimaryFixedVariant',
  'secondaryFixed', 'secondaryFixedDim', 'onSecondaryFixed', 'onSecondaryFixedVariant',
  'tertiaryFixed', 'tertiaryFixedDim', 'onTertiaryFixed', 'onTertiaryFixedVariant',
];

function palette(dark) {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), dark, 0);
  return roles.map((role) => `    ${role}: '${hexFromArgb(MaterialDynamicColors[role].getArgb(scheme)).toUpperCase()}',`).join('\n');
}

const file = join(import.meta.dirname, '..', 'src', 'theme', 'materialSeed.ts');
writeFileSync(
  file,
  `export const seedColor = '${seed}';

export const seedPalettes = {
  light: {
${palette(false)}
  },
  dark: {
${palette(true)}
  },
} as const;
`,
);
console.log(file);
