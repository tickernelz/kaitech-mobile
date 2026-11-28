import { radioGeometry, type RadioGeometry } from '../src/ui/radio';

const densities = [1, 1.5, 1.75, 2, 2.625, 3, 3.5];
const shipped: RadioGeometry = { ring: 22, border: 2, dot: 10 };

function yogaRound(px: number): number {
  const fraction = ((px % 1) + 1) % 1;
  if (Math.abs(fraction) < 1e-4) return px - fraction;
  if (Math.abs(fraction - 1) < 1e-4) return px - fraction + 1;
  return px - fraction + (fraction > 0.5 || Math.abs(fraction - 0.5) < 1e-4 ? 1 : 0);
}

function worstOffCenter(g: RadioGeometry, scale: number): number {
  let worst = 0;
  for (let step = 0; step < 100; step++) {
    const ringLeft = 1000 + step / 100;
    const dotOffset = ((g.ring - g.dot) / 2) * scale;
    const ringWidth = yogaRound(ringLeft + g.ring * scale) - yogaRound(ringLeft);
    const dotLeft = ringLeft + dotOffset;
    const dotWidth = yogaRound(dotLeft + g.dot * scale) - yogaRound(dotLeft);
    const dotCenter = yogaRound(dotOffset) + dotWidth / 2;
    worst = Math.max(worst, Math.abs(dotCenter - ringWidth / 2));
  }
  return worst;
}

function evenGapInWholePixels(g: RadioGeometry, scale: number): boolean {
  const px = [g.ring, g.border, g.dot].map((value) => value * scale);
  if (px.some((value) => Math.abs(value - Math.round(value)) > 1e-6)) return false;
  const [ring, border, dot] = px.map(Math.round);
  return (ring - 2 * border - dot) % 2 === 0;
}

describe('radio geometry', () => {
  it.each(densities)('keeps ring, stroke and dot on whole pixels with an even gap at density %p', (scale) => {
    expect(evenGapInWholePixels(radioGeometry(scale), scale)).toBe(true);
  });

  it.each(densities)('centres the dot in the ring at every row position at density %p', (scale) => {
    expect(worstOffCenter(radioGeometry(scale), scale)).toBe(0);
  });

  it.each(densities)('stays within one pixel of the 22/2/10 dp design at density %p', (scale) => {
    const g = radioGeometry(scale);
    expect(Math.abs(g.ring - shipped.ring) * scale).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g.border - shipped.border) * scale).toBeLessThanOrEqual(0.5);
    expect(Math.abs(g.dot - shipped.dot) * scale).toBeLessThanOrEqual(1);
  });

  it.each([1.75, 2.625])('rejects the fixed 22/2/10 dp geometry at density %p', (scale) => {
    expect(evenGapInWholePixels(shipped, scale)).toBe(false);
    expect(worstOffCenter(shipped, scale)).toBeGreaterThanOrEqual(1);
  });
});
