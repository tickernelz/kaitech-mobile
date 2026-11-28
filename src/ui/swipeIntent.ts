export const swipeStart = 28;
export const swipeCrossSlop = 14;

export type SwipeVerdict = 'swipe' | 'scroll' | 'undecided';

export function swipeVerdict(translationX: number, translationY: number): SwipeVerdict {
  'worklet';
  if (Math.abs(translationY) >= swipeCrossSlop) return 'scroll';
  if (Math.abs(translationX) >= swipeStart) return 'swipe';
  return 'undecided';
}

export function swipeHeldSideways(translationX: number, translationY: number): boolean {
  'worklet';
  return Math.abs(translationX) >= Math.abs(translationY);
}
