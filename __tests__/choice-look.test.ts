import { colorsFor, contrast, type Scheme } from '../src/theme/tokens';
import { choiceLook } from '../src/ui/pill';

describe.each<Scheme>(['light', 'dark'])('%s choice look', (scheme) => {
  const colors = colorsFor(scheme);
  const rest = { fill: colors.surface, paddingHorizontal: 12 };

  it('keeps the chip width when it turns on', () => {
    const off = { borderWidth: 1, ...choiceLook(false, colors, rest) };
    const on = { borderWidth: 1, paddingHorizontal: rest.paddingHorizontal, ...choiceLook(true, colors, rest) };
    expect(Number(on.paddingHorizontal) + Number(on.borderWidth)).toBe(rest.paddingHorizontal + Number(off.borderWidth));
  });

  it('keeps a content-sized choice the same height when it turns on', () => {
    const tall = { ...rest, paddingVertical: 8 };
    const on = { borderWidth: 1, ...choiceLook(true, colors, tall) };
    expect(Number(on.paddingVertical) + Number(on.borderWidth)).toBe(tall.paddingVertical + 1);
    expect('paddingVertical' in choiceLook(true, colors, rest)).toBe(false);
  });

  it('marks the selected choice with an outline that reaches 3:1 against the fill it replaces and its own fill', () => {
    const on = choiceLook(true, colors, rest);
    for (const fill of [colors.canvas, colors.surface, colors.surface2, colors.select]) expect(contrast(on.borderColor as string, fill)).toBeGreaterThanOrEqual(3);
    expect(on.borderWidth).toBe(2);
  });
});
