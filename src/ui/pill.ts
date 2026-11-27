import { space } from '../theme/tokens';
import { touchTarget } from './touch';

export const glassEdge = 1;
const composerHeight = 52;

export const pill = {
  tab: { height: 68, padding: space.sm, labelGap: 4 },
  composer: { height: composerHeight, button: composerHeight, gap: space.sm, inside: composerHeight - 2 * glassEdge },
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
