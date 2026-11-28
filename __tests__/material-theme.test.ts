import { materialColors, seedColor, type MaterialRole } from '../src/theme/material';
import { seedPalettes } from '../src/theme/materialSeed';
import { colorsFor, type Scheme } from '../src/theme/tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const schemes: Scheme[] = ['light', 'dark'];

const pairs: [MaterialRole, MaterialRole][] = [
  ['primary', 'onPrimary'],
  ['primaryContainer', 'onPrimaryContainer'],
  ['secondaryContainer', 'onSecondaryContainer'],
  ['tertiaryContainer', 'onTertiaryContainer'],
  ['error', 'onError'],
  ['errorContainer', 'onErrorContainer'],
  ['background', 'onBackground'],
  ['surface', 'onSurface'],
  ['surface', 'onSurfaceVariant'],
  ['surfaceContainer', 'onSurface'],
  ['surfaceContainerHighest', 'onSurfaceVariant'],
  ['inverseSurface', 'inverseOnSurface'],
];

describe('Material 3 colour roles', () => {
  test.each(schemes)('%s: the accent roles come from the Kaitech seed, and Android tokens draw with them', (scheme) => {
    expect(seedColor).toBe('#441D65');
    const roles = materialColors(scheme);
    for (const role of ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary', 'surfaceTint'] as const) expect(roles[role]).toBe(seedPalettes[scheme][role]);
    jest.isolateModules(() => {
      const { Platform } = require('react-native') as typeof import('react-native');
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      const android = (require('../src/theme/tokens') as typeof import('../src/theme/tokens')).colorsFor(scheme);
      expect([android.primary, android.onPrimary]).toEqual([roles.primary, roles.onPrimary]);
    });
  });

  test.each(schemes)('%s: surfaces and error stay on the Kaitech tokens', (scheme) => {
    const roles = materialColors(scheme);
    const colors = colorsFor(scheme);
    expect(roles.surface).toBe(colors.surface);
    expect(roles.background).toBe(colors.canvas);
    expect(roles.onSurface).toBe(colors.ink);
    expect(roles.error).toBe(colors.dangerInk);
    expect(roles.secondaryContainer).toBe(colors.select);
  });

  test.each(schemes)('%s: every content role is readable on its container (WCAG AA 4.5:1)', (scheme) => {
    const roles = materialColors(scheme);
    const failing = pairs
      .map(([fill, ink]) => ({ pair: `${fill}/${ink}`, ratio: Math.round(contrast(roles[fill], roles[ink]) * 100) / 100 }))
      .filter(({ ratio }) => ratio < 4.5);
    expect(failing).toEqual([]);
  });

  test('Android titles keep Plus Jakarta Sans while body text takes the M3 scale', () => {
    jest.isolateModules(() => {
      const { Platform } = require('react-native') as typeof import('react-native');
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      const { type } = require('../src/theme') as typeof import('../src/theme');
      expect(type.display.fontFamily).toBe('Plus Jakarta Sans');
      expect(type.title.fontFamily).toBe('Plus Jakarta Sans');
      expect(type.body).toMatchObject({ fontSize: 16, lineHeight: 24 });
      expect('fontFamily' in type.body).toBe(false);
    });
  });

  test.each(schemes)('%s: every role is an opaque hex colour Compose accepts', (scheme) => {
    const bad = Object.entries(materialColors(scheme)).filter(([, value]) => !/^#[0-9A-F]{6}$/i.test(value));
    expect(bad).toEqual([]);
  });
});
