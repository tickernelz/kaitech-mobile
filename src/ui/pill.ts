import type { ViewStyle } from 'react-native';
import { space, stroke, type Colors } from '../theme/tokens';
import { touchTarget } from './touch';

export const glassEdge = stroke.thin;
export const selectedEdge = 2;

export function choiceLook(on: boolean, colors: Colors, rest: { fill: string; paddingHorizontal: number; paddingVertical?: number; edge?: string }): ViewStyle {
  if (!on) return { backgroundColor: rest.fill, borderColor: rest.edge ?? colors.line };
  const inset = stroke.thin - selectedEdge;
  return {
    backgroundColor: colors.select,
    borderColor: colors.focus,
    borderWidth: selectedEdge,
    paddingHorizontal: rest.paddingHorizontal + inset,
    ...(rest.paddingVertical === undefined ? null : { paddingVertical: rest.paddingVertical + inset }),
  };
}
const composerHeight = 52;
const composerInside = composerHeight - 2 * glassEdge;
const composerIcon = 24;

export const pill = {
  tab: { height: 68, padding: space.sm, labelGap: 4 },
  composer: { height: composerHeight, button: composerHeight, gap: space.sm, inside: composerInside, icon: composerIcon, inset: (composerInside - composerIcon) / 2 },
  call: { button: 56, gap: space.sm, padding: space.sm, endGap: space.sm },
} as const;

export function callButtonSize(count: number, room: number): number {
  const { button, gap, padding, endGap } = pill.call;
  const fits = Math.floor((room - 2 * padding - (count - 1) * gap - endGap) / count);
  return Math.max(touchTarget, Math.min(button, fits));
}

export function callPillThickness(button: number): number {
  return button + 2 * pill.call.padding;
}
