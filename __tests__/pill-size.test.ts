import { callButtonSize, callPillThickness, glassEdge, pill } from '../src/ui/pill';
import { touchTarget } from '../src/ui/touch';

const length = (count: number, button: number) => count * button + (count - 1) * pill.call.gap + pill.call.endGap + 2 * pill.call.padding;

describe('shared pill sizes', () => {
  test('every pill is roomier than the 44 dp minimum touch target', () => {
    expect(pill.composer.height).toBeGreaterThan(touchTarget);
    expect(pill.composer.button).toBeGreaterThan(touchTarget);
    expect(pill.tab.height - 2 * pill.tab.padding).toBeGreaterThan(touchTarget);
    expect(pill.call.button).toBeGreaterThan(touchTarget);
  });

  test('controls inside the composer capsule fill it between its glass edges, so they centre on the send button beside it', () => {
    expect(pill.composer.inside + 2 * glassEdge).toBe(pill.composer.height);
    expect(pill.composer.height).toBe(pill.composer.button);
    expect(pill.composer.inside).toBeGreaterThan(touchTarget);
  });

  test.each([360, 393, 411])('a %i dp phone keeps the full call button size for the five pill controls', (width) => {
    expect(callButtonSize(5, width - 16)).toBe(pill.call.button);
    expect(length(5, callButtonSize(5, width - 16))).toBeLessThanOrEqual(width - 16);
  });

  test.each([320, 340])('a narrow %i dp phone shrinks the call buttons so the pill fits, never below the touch target', (width) => {
    const button = callButtonSize(5, width - 16);
    expect(button).toBeLessThan(pill.call.button);
    expect(button).toBeGreaterThanOrEqual(touchTarget);
    expect(length(5, button)).toBeLessThanOrEqual(width - 16);
  });

  test('the pill thickness follows the button size, so the call stage leaves room for it', () => {
    expect(callPillThickness(pill.call.button)).toBe(pill.call.button + 2 * pill.call.padding);
  });
});
