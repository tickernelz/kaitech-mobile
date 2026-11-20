import { windowClassFor } from '../src/layout/windowClass';

describe('windowClassFor', () => {
  it.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [839, 'medium'],
    [840, 'expanded'],
    [1366, 'expanded'],
  ])('puts a %pdp wide window in %p', (width, windowClass) => {
    expect(windowClassFor(width)).toBe(windowClass);
  });
});
