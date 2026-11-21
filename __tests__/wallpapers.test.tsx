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

type Node = { type: string; props: Record<string, unknown>; children: Node[] | null };

function flatten(tree: unknown): Node[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(flatten);
  const node = tree as Node;
  return [node, ...flatten(node.children)];
}

const argb = (hex: string) => (0xff000000 + parseInt(hex.slice(1, 7), 16)) >>> 0;
const pairs = (values: number[]) => values.flatMap((value, index) => (index % 2 ? [] : [[value, values[index + 1] >>> 0]]));

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

  it.each(looks)('%s (%s) paints its field, pattern and scrim', async (wallpaperId, scheme, look) => {
    const view = await render(<Wallpaper id={wallpaperId} scheme={scheme} />);
    const nodes = flatten(view.toJSON());
    const rects = nodes.filter((node) => node.type === 'RNSVGRect');
    const [field, ...overlays] = rects;
    if (look.field.kind === 'solid') {
      expect(field.props.fill).toEqual({ type: 0, payload: argb(look.field.color) });
    } else {
      expect(field.props.fill).toEqual({ type: 1, brushRef: 'wallpaperField' });
      const gradient = nodes.find((node) => node.type === 'RNSVGLinearGradient')!;
      expect(pairs(gradient.props.gradient as number[])).toEqual(look.field.stops.map(([offset, color]) => [offset, argb(color)]));
    }
    const pattern = nodes.find((node) => node.type === 'RNSVGPattern');
    if (look.pattern) {
      const tile = tiles[look.pattern.name];
      expect(overlays[0].props.fill).toEqual({ type: 1, brushRef: 'wallpaperPattern' });
      expect(pattern!.props).toMatchObject({ width: tile.width, height: tile.height });
      const inside = flatten(pattern!);
      expect(inside.find((node) => node.type === 'RNSVGGroup')!.props.opacity).toBe(look.pattern.opacity);
      expect(inside.filter((node) => node.type === 'RNSVGPath')).toHaveLength(tile.marks.length + (tile.grid ? 1 : 0));
    } else {
      expect(pattern).toBeUndefined();
    }
    if (look.scrim) {
      expect(overlays.at(-1)!.props).toMatchObject({ fill: { type: 0, payload: argb(look.scrim.color) }, opacity: look.scrim.opacity });
    }
    expect(rects).toHaveLength(1 + (look.pattern ? 1 : 0) + (look.scrim ? 1 : 0));
  });
});
