export const swipeStart = 28;
export const swipeCrossSlop = 14;

export function swipeHeldSideways(translationX: number, translationY: number): boolean {
  'worklet';
  return Math.abs(translationX) >= Math.abs(translationY);
}
