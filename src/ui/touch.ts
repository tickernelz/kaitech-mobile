import type { Insets, ViewStyle } from 'react-native';

export const touchTarget = 44;

export function shortfall(size: number): number {
  return Math.max(0, Math.ceil((touchTarget - size) / 2));
}

export function reach(height: number, width: number = touchTarget): Insets {
  return { top: shortfall(height), bottom: shortfall(height), left: shortfall(width), right: shortfall(width) };
}

export function band(height: number): ViewStyle {
  return { paddingVertical: shortfall(height), marginVertical: -shortfall(height) };
}

export const chipHeight = 36;
export const chipSlop = reach(chipHeight);
export const chipBand = band(chipHeight);
