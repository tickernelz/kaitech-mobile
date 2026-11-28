import { createContext, useContext } from 'react';
import { space } from '../theme/tokens';
import { pill } from '../ui/pill';

export const pillHeight = pill.tab.height;
export const pillPadding = pill.tab.padding;
export const pillMaxWidth = 440;
const glyph = 24;
const labelGap = space.sm;

export function pillBottom(bottomInset: number): number {
  return bottomInset + space.sm;
}

export function pillCover(bottomInset: number): number {
  return pillBottom(bottomInset) + pillHeight;
}

export function pillWidth(windowWidth: number, sideInsets: number): number {
  return Math.min(windowWidth - sideInsets - 2 * space.lg, pillMaxWidth);
}

export function pillSlots(width: number, count: number): { wide: number; narrow: number } {
  const inner = width - 2 * pillPadding;
  const wide = Math.round(Math.max(inner * 0.4, inner / Math.max(count, 1)));
  return { wide, narrow: count > 1 ? (inner - wide) / (count - 1) : wide };
}

export function labelRoom(wide: number): number {
  return wide - glyph - labelGap - 2 * space.md;
}

export function openness(index: number, position: number): number {
  'worklet';
  return Math.max(0, 1 - Math.abs(position - index));
}

export function slotLeft(index: number, position: number, wide: number, narrow: number): number {
  'worklet';
  let left = 0;
  for (let before = 0; before < index; before++) left += narrow + (wide - narrow) * openness(before, position);
  return left;
}

export function glyphLeft(index: number, position: number, wide: number, narrow: number, label: number): number {
  'worklet';
  const open = openness(index, position);
  const slot = narrow + (wide - narrow) * open;
  return slotLeft(index, position, wide, narrow) + (slot - glyph - open * (labelGap + label)) / 2;
}

export const TabBarSpace = createContext(0);

export function useTabBarSpace(): number {
  return useContext(TabBarSpace);
}
