import { Easing, useReducedMotion } from 'react-native-reanimated';

export const duration = { quick: 120, base: 180, slow: 240, hero: 320, axis: 300 } as const;

export const easing = {
  standard: Easing.bezier(0.25, 1, 0.5, 1),
  expo: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.bezier(0.5, 0, 0.75, 0),
} as const;

export const shift = { small: 4, large: 8 } as const;

function springOf(dampingRatio: number, stiffness: number) {
  return { stiffness, damping: 2 * dampingRatio * Math.sqrt(stiffness), mass: 1 };
}

export const spring = {
  spatialFast: springOf(0.6, 800),
  spatial: springOf(0.8, 380),
  spatialSlow: springOf(0.8, 200),
  effectsFast: springOf(1, 3800),
  effects: springOf(1, 1600),
} as const;

export const stagger = 60;

export function useMotion<T>(animation: T): T | undefined {
  return useReducedMotion() ? undefined : animation;
}
