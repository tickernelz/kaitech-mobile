import { swipeCrossSlop, swipeHeldSideways, swipeStart, swipeVerdict } from '../src/ui/swipeIntent';

function along(degreesFromHorizontal: number, distance: number): [number, number] {
  const radians = (degreesFromHorizontal * Math.PI) / 180;
  return [distance * Math.cos(radians), distance * Math.sin(radians)];
}

function firstVerdict(degreesFromHorizontal: number): string {
  for (let distance = 1; distance <= 200; distance += 1) {
    const verdict = swipeVerdict(...along(degreesFromHorizontal, distance));
    if (verdict !== 'undecided') return verdict;
  }
  return 'undecided';
}

describe('telling a sideways swipe from a scroll', () => {
  it('needs 28 dp sideways before a swipe starts', () => {
    expect(swipeStart).toBeGreaterThanOrEqual(28);
    expect(swipeVerdict(27, 0)).toBe('undecided');
    expect(swipeVerdict(-27, 0)).toBe('undecided');
    expect(swipeVerdict(28, 0)).toBe('swipe');
    expect(swipeVerdict(-28, 5)).toBe('swipe');
  });

  it('treats a drag that moves 14 dp up or down first as a scroll', () => {
    expect(swipeVerdict(20, 14)).toBe('scroll');
    expect(swipeVerdict(0, -14)).toBe('scroll');
    expect(swipeVerdict(40, 14)).toBe('scroll');
  });

  it('starts a swipe only within about 26 degrees of horizontal (2:1)', () => {
    expect(swipeStart / swipeCrossSlop).toBeGreaterThanOrEqual(2);
    expect(firstVerdict(0)).toBe('swipe');
    expect(firstVerdict(15)).toBe('swipe');
    expect(firstVerdict(20)).toBe('swipe');
    expect(firstVerdict(30)).toBe('scroll');
    expect(firstVerdict(60)).toBe('scroll');
    expect(firstVerdict(75)).toBe('scroll');
    expect(firstVerdict(90)).toBe('scroll');
  });

  it('keeps a started reply while it stays at least as sideways as it is vertical', () => {
    expect(swipeHeldSideways(60, 0)).toBe(true);
    expect(swipeHeldSideways(60, -60)).toBe(true);
    expect(swipeHeldSideways(60, 61)).toBe(false);
    expect(swipeHeldSideways(-60, -61)).toBe(false);
  });
});
