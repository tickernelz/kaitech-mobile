import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

export type Surface = 'glass' | 'solid';

export type Legibility = { reduceTransparency: boolean; increaseContrast: boolean };

export function surfaceFor(glass: boolean, legibility: Legibility): Surface {
  return glass && !legibility.reduceTransparency && !legibility.increaseContrast ? 'glass' : 'solid';
}

let legibility: Legibility = { reduceTransparency: true, increaseContrast: true };
let watching = false;
const listeners = new Set<() => void>();

function update(patch: Partial<Legibility>) {
  legibility = { ...legibility, ...patch };
  listeners.forEach((listener) => listener());
}

function watch() {
  if (watching) return;
  watching = true;
  AccessibilityInfo.isReduceTransparencyEnabled().then(
    (on) => update({ reduceTransparency: on }),
    () => update({ reduceTransparency: false }),
  );
  AccessibilityInfo.isDarkerSystemColorsEnabled().then(
    (on) => update({ increaseContrast: on }),
    () => update({ increaseContrast: false }),
  );
  AccessibilityInfo.addEventListener('reduceTransparencyChanged', (on) => update({ reduceTransparency: on }));
  AccessibilityInfo.addEventListener('darkerSystemColorsChanged', (on) => update({ increaseContrast: on }));
}

function subscribe(listener: () => void) {
  watch();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const current = () => legibility;

export function useSurface(): Surface {
  const glass = isLiquidGlassAvailable();
  const seen = useSyncExternalStore(glass ? subscribe : noSubscription, current);
  return surfaceFor(glass, seen);
}

function noSubscription() {
  return () => undefined;
}
