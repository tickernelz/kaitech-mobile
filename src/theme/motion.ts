import { Easing, useReducedMotion } from 'react-native-reanimated';

export const duration = { quick: 120, base: 180, slow: 240, hero: 320, axis: 300 } as const;

export const easing = {
  standard: Easing.bezier(0.25, 1, 0.5, 1),
  expo: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.bezier(0.5, 0, 0.75, 0),
} as const;

export const shift = { small: 4, large: 8 } as const;

export const stagger = 60;

export function useMotion<T>(animation: T): T | undefined {
  return useReducedMotion() ? undefined : animation;
}
