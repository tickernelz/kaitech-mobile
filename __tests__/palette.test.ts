import { avatarFill, avatarFills, colorsFor, type ColorName, type Scheme } from '../src/theme/tokens';
import { series, seriesColor } from '../src/features/discovery/kt/ui';

function channel(value: number) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((at) => channel(parseInt(hex.slice(at, at + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function saturation(hex: string) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  return max === min ? 0 : (max - min) / (light > 0.5 ? 2 - max - min : max + min);
}

const text: [ColorName, ColorName[]][] = [
  ['ink', ['canvas', 'surface', 'surface2', 'select']],
  ['inkSoft', ['canvas', 'surface', 'surface2', 'select']],
  ['inkFaint', ['canvas', 'surface', 'surface2', 'select']],
  ['selectInk', ['select', 'surface', 'surface2', 'canvas']],
  ['onPrimary', ['primary', 'primaryPressed']],
  ['link', ['canvas', 'surface', 'surface2', 'select']],
  ['okInk', ['okBand', 'surface']],
  ['warnInk', ['warnBand', 'surface']],
  ['dangerInk', ['dangerBand', 'surface']],
  ['infoInk', ['infoBand', 'surface']],
  ['onStage', ['stage']],
];

const controls: [ColorName, ColorName[]][] = [
  ['primary', ['canvas', 'surface', 'surface2', 'select']],
  ['edge', ['canvas', 'surface']],
  ['focus', ['surface', 'select']],
  ['danger', ['surface', 'onDanger']],
];

describe.each<Scheme>(['light', 'dark'])('%s palette', (scheme) => {
  const colors = colorsFor(scheme);

  it.each(text)('%s text reaches 4.5:1', (fg, backgrounds) => {
    expect(backgrounds.filter((bg) => contrast(colors[fg], colors[bg]) < 4.5)).toEqual([]);
  });

  it.each(controls)('%s controls reach 3:1', (fg, backgrounds) => {
    expect(backgrounds.filter((bg) => contrast(colors[fg], colors[bg]) < 3)).toEqual([]);
  });

  it('keeps surfaces neutral', () => {
    for (const name of ['canvas', 'surface', 'surface2', 'line', 'lineStrong'] as const) expect(saturation(colors[name])).toBeLessThan(0.08);
  });

  it('keeps every chart series at 3:1 on the surface', () => {
    expect(series.map((_, index) => seriesColor(index, scheme)).filter((ink) => contrast(ink, colors.surface) < 3)).toEqual([]);
  });
});

it.each(['android', 'ios'])('%s: every heatmap level keeps its number at 4.5:1 on canvas, surface and surface2', (os) => {
  jest.isolateModules(() => {
    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    const theme = require('../src/theme/tokens') as typeof import('../src/theme/tokens');
    const { heatFill } = require('../src/features/discovery/kt/ui') as typeof import('../src/features/discovery/kt/ui');
    const failing = (['light', 'dark'] as const).flatMap((scheme) => {
      const colors = theme.colorsFor(scheme);
      return [0, 1, 2, 3, 4, 5].flatMap((level) => {
        const paint = heatFill(level, true, colors);
        return (['canvas', 'surface', 'surface2'] as const).filter((bg) => contrast(paint.ink, theme.blend(paint.fill, paint.opacity, colors[bg])) < 4.5).map((bg) => `${scheme} level ${level} on ${bg}`);
      });
    });
    expect(failing).toEqual([]);
  });
});

it('puts white initials on every avatar fill at 4.5:1', () => {
  expect(avatarFills.filter((fill) => contrast('#FFFFFF', fill) < 4.5)).toEqual([]);
});

it('picks the avatar fill of a partner id as the web chat does', () => {
  expect(avatarFills).toEqual(['#8E565F', '#3A775E', '#27767A', '#426D91', '#646393', '#7F5A81']);
  expect([6, 7, 11, -7].map(avatarFill)).toEqual(['#8E565F', '#3A775E', '#7F5A81', '#3A775E']);
});
