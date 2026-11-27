import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import { colorsFor, type Scheme } from '../src/theme/tokens';
import { materialColors } from '../src/theme/material';
import { glassMaterial, type Thickness } from '../src/ui/glassMaterial';

let mockSeeThrough = true;
let mockSurface: 'glass' | 'solid' = 'solid';
jest.mock('../src/ui/glass', () => ({ useSeeThrough: () => mockSeeThrough, useSurface: () => mockSurface }));

const { GlassCapsule } = require('../src/ui/GlassCapsule') as typeof import('../src/ui/GlassCapsule');

type Rgb = [number, number, number];

function parse(hex: string): { rgb: Rgb; alpha: number } {
  const digits = hex.replace('#', '');
  const rgb = [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16) / 255) as Rgb;
  return { rgb, alpha: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1 };
}

function over(top: string, under: Rgb): Rgb {
  const { rgb, alpha } = parse(top);
  return rgb.map((channel, at) => channel * alpha + under[at] * (1 - alpha)) as Rgb;
}

function luminance(rgb: Rgb) {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const white = parse('#FFFFFF').rgb;
const black = parse('#000000').rgb;
const behind = { white, black };
const oses = ['ios', 'android'] as const;
const schemes: Scheme[] = ['light', 'dark'];

type Use = { name: string; thickness: Thickness; ink: (scheme: Scheme, os: (typeof oses)[number]) => string; min: number; well?: boolean; tone?: Scheme; only?: (typeof oses)[number] };

const uses: Use[] = [
  { name: 'tab label (iOS below 26)', thickness: 'regular', ink: (scheme) => colorsFor(scheme).ink, min: 4.5, only: 'ios' },
  { name: 'tab icon (Android)', thickness: 'regular', ink: (scheme) => materialColors(scheme).onSurfaceVariant, min: 3, only: 'android' },
  { name: 'call button off the stage', thickness: 'regular', ink: (scheme) => colorsFor(scheme).ink, min: 3, well: true },
  { name: 'call button over video', thickness: 'regular', ink: () => colorsFor('dark').onStage, min: 3, well: true, tone: 'dark' },
  { name: 'typed message', thickness: 'thick', ink: (scheme) => colorsFor(scheme).ink, min: 4.5 },
  { name: 'composer placeholder', thickness: 'thick', ink: (scheme) => colorsFor(scheme).inkSoft, min: 4.5 },
  { name: 'composer icon', thickness: 'thick', ink: (scheme) => colorsFor(scheme).inkSoft, min: 3 },
];

describe('glass contrast over any content', () => {
  const rows = uses.flatMap((use) =>
    oses
      .filter((os) => !use.only || use.only === os)
      .flatMap((os) => schemes.flatMap((scheme) => Object.entries(behind).map(([under, rgb]) => ({ use, os, scheme, under, rgb })))),
  );
  test.each(rows.map((row) => [`${row.use.name}, ${row.os}, ${row.scheme}, over ${row.under}`, row] as const))('%s keeps AA', (_, { use, os, scheme, rgb }) => {
    const glass = glassMaterial(use.tone ?? scheme, use.thickness, os);
    const body = over(glass.tint, rgb);
    const ground = use.well ? over(glass.well, body) : body;
    expect(contrast(parse(use.ink(use.tone ?? scheme, os)).rgb, ground)).toBeGreaterThanOrEqual(use.min);
  });
});

describe('glass stands apart from a plain screen', () => {
  const screens = (scheme: Scheme) => ({ ios: [colorsFor(scheme).surface, colorsFor(scheme).canvas], android: [materialColors(scheme).background, materialColors(scheme).surface] });
  test.each(oses.flatMap((os) => schemes.map((scheme) => [os, scheme] as const)))('on %s in %s the capsule body and its edge stand apart from the screen behind it', (os, scheme) => {
    const glass = glassMaterial(scheme, 'regular', os);
    for (const screenColor of screens(scheme)[os]) {
      const ground = parse(screenColor).rgb;
      expect(contrast(over(glass.tint, ground), ground)).toBeGreaterThanOrEqual(1.1);
      expect(contrast(parse(glass.edge).rgb, ground)).toBeGreaterThanOrEqual(1.15);
    }
  });

  test.each(oses)('on %s in light the button well stands apart from the capsule body', (os) => {
    const glass = glassMaterial('light', 'regular', os);
    for (const screenColor of screens('light')[os]) {
      const body = over(glass.tint, parse(screenColor).rgb);
      expect(contrast(over(glass.well, body), body)).toBeGreaterThanOrEqual(1.2);
    }
  });

  test('every colour comes from the Kaitech theme: the tint is the glass colour on iOS and the highest Material surface container on Android', () => {
    for (const scheme of schemes) {
      expect(glassMaterial(scheme, 'regular', 'ios').tint.slice(0, 7)).toBe(colorsFor(scheme).glass);
      expect(glassMaterial(scheme, 'thick', 'android').tint.slice(0, 7)).toBe(materialColors(scheme).surfaceContainerHighest);
      expect(glassMaterial(scheme, 'regular', 'ios').edge).toBe(colorsFor(scheme).lineStrong);
      expect(glassMaterial(scheme, 'regular', 'android').edge).toBe(materialColors(scheme).outlineVariant);
    }
  });
});

describe('GlassCapsule', () => {
  const os = Platform.OS;
  afterEach(() => {
    mockSeeThrough = true;
    mockSurface = 'solid';
    Platform.OS = os;
  });

  function capsule(props: Partial<Parameters<typeof GlassCapsule>[0]> = {}) {
    return (
      <GlassCapsule solid={{ backgroundColor: '#123456' }} style={{ borderRadius: 22 }} testID="capsule" {...props}>
        <Text>inside</Text>
      </GlassCapsule>
    );
  }
  const style = () => Object.assign({}, ...[screen.getByTestId('capsule').props.style].flat(3).filter(Boolean));

  test('falls back to the solid surface when Reduce Transparency, Increase Contrast or high text contrast is on', async () => {
    mockSeeThrough = false;
    await render(capsule());
    expect(style().backgroundColor).toBe('#123456');
    expect(screen.queryByTestId('glass-backdrop')).toBeNull();
    expect(screen.getByText('inside')).toBeTruthy();
  });

  test('on iOS below 26 the capsule blurs what is behind it under the Kaitech tint', async () => {
    Platform.OS = 'ios';
    await render(capsule());
    expect(screen.getByTestId('glass-blur')).toBeTruthy();
    expect(Object.assign({}, ...[screen.getByTestId('glass-backdrop').props.style].flat()).borderRadius).toBe(22);
  });

  test('uses the system Liquid Glass only where asked and available', async () => {
    mockSurface = 'glass';
    const view = await render(capsule());
    expect(screen.getByTestId('glass-backdrop')).toBeTruthy();
    await view.rerender(capsule({ liquid: true }));
    expect(screen.queryByTestId('glass-backdrop')).toBeNull();
    expect(screen.getByTestId('capsule').type).toBe('ExpoGlassView');
  });
});
