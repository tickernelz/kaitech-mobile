import { render } from '@testing-library/react-native';
import en from '../src/i18n/locales/en.json';
import id from '../src/i18n/locales/id.json';
import { Wallpaper, isWallpaperId, wallpaperIds, wallpapers, type Look } from '../src/features/appearance/wallpapers';
import { glyphBox, glyphs, tiles } from '../src/features/appearance/wallpapers/motifs';
import { colorsFor, type Scheme } from '../src/theme/tokens';

type Rgb = [number, number, number];

const channels = (hex: string): Rgb => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as Rgb;
const linear = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const lightness = (rgb: Rgb) => {
  const y = luminance(rgb);
  return 116 * (y > 216 / 24389 ? Math.cbrt(y) : ((24389 / 27) * y + 16) / 116) - 16;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
const over = (base: Rgb, top: string, alpha: number): Rgb => base.map((value, index) => value * (1 - alpha) + channels(top)[index] * alpha) as Rgb;

function fieldSamples({ field }: Look): Rgb[] {
  if (field.kind === 'solid') return [channels(field.color)];
  return Array.from({ length: 33 }, (_, step) => {
    const t = step / 32;
    const index = Math.max(0, field.stops.findIndex(([offset]) => offset >= t) - 1);
    const [fromOffset, fromColor] = field.stops[index];
    const [toOffset, toColor] = field.stops[index + 1];
    return over(channels(fromColor), toColor, (t - fromOffset) / (toOffset - fromOffset));
  });
}

function dimmed(look: Look, color: Rgb): Rgb {
  return look.scrim ? over(color, look.scrim.color, look.scrim.opacity) : color;
}

const looks = wallpapers.flatMap((wallpaper) => (['light', 'dark'] as Scheme[]).map((scheme) => [wallpaper.id, scheme, wallpaper[scheme]] as const));

describe('chat wallpapers', () => {
  it('ships 10 to 12 presets with unique ids and a name in every language', () => {
    expect(wallpapers.length).toBeGreaterThanOrEqual(10);
    expect(wallpapers.length).toBeLessThanOrEqual(12);
    expect(new Set(wallpaperIds).size).toBe(wallpapers.length);
    for (const catalog of [en, id]) {
      for (const wallpaper of wallpapers) {
        const [, , key] = wallpaper.nameKey.split('.');
        expect(catalog.appearance.wallpapers[key as keyof typeof catalog.appearance.wallpapers]).toEqual(expect.any(String));
      }
    }
  });

  it('accepts only known ids from storage', () => {
    expect(isWallpaperId('doodle')).toBe(true);
    expect(isWallpaperId('removed-preset')).toBe(false);
    expect(isWallpaperId(null)).toBe(false);
  });

  it.each(looks)('%s (%s) keeps both bubbles apart from every wallpaper colour', (_id, scheme, look) => {
    const colors = colorsFor(scheme);
    const bubbles = [colors.surface, colors.select].map((hex) => lightness(channels(hex)));
    const field = fieldSamples(look).map((color) => lightness(dimmed(look, color)));
    const gaps = field.flatMap((value) => bubbles.map((bubble) => Math.abs(value - bubble)));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(6);
  });

  it.each(looks)('%s (%s) keeps the pattern quiet and on-wallpaper text readable', (_id, _scheme, look) => {
    const fields = fieldSamples(look);
    const paints = look.pattern ? [look.pattern.color, look.pattern.accent ?? look.pattern.color] : [];
    const strokes = fields.flatMap((field) => paints.map((paint) => [field, over(field, paint, look.pattern!.opacity)] as const));
    for (const [field, stroke] of strokes) {
      expect(Math.abs(lightness(dimmed(look, stroke)) - lightness(dimmed(look, field)))).toBeLessThanOrEqual(15);
    }
    const surfaces = [...fields, ...strokes.map(([, stroke]) => stroke)].map((color) => dimmed(look, color));
    expect(Math.min(...surfaces.map((color) => contrast(channels(look.ink), color)))).toBeGreaterThanOrEqual(4.5);
  });

  it('draws every glyph inside its 24 grid', () => {
    for (const glyph of Object.values(glyphs)) {
      const numbers = glyph.d.match(/-?\d*\.?\d+/g)!.map(Number);
      expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...numbers)).toBeLessThanOrEqual(glyphBox);
    }
  });

  it.each(Object.entries(tiles))('keeps every %s mark inside its tile so the pattern repeats without a seam', (_name, tile) => {
    for (const mark of tile.marks) {
      const reach = (mark.size * Math.SQRT2) / 2 + tile.stroke;
      expect(mark.x - reach).toBeGreaterThanOrEqual(0);
      expect(mark.y - reach).toBeGreaterThanOrEqual(0);
      expect(mark.x + reach).toBeLessThanOrEqual(tile.width);
      expect(mark.y + reach).toBeLessThanOrEqual(tile.height);
    }
    if (tile.grid) {
      expect(tile.width % tile.grid.step).toBe(0);
      expect(tile.height % tile.grid.step).toBe(0);
    }
  });

  it.each(looks)('%s (%s) renders', async (wallpaperId, scheme) => {
    const screen = await render(<Wallpaper id={wallpaperId} scheme={scheme} />);
    expect(screen.getByTestId(`wallpaper-${wallpaperId}`)).toBeTruthy();
  });
});
