export const directionSlop = 12;
export const cancelDistance = 96;
export const cancelHintDistance = 48;
export const lockDistance = 64;
export const shortestVoiceMs = 1000;

export type SendMode = 'mic' | 'send' | 'voice';

export function sendModeOf({ text, files, locked }: { text: string; files: number; locked: boolean }): SendMode {
  if (locked) return 'voice';
  return text.trim().length > 0 || files > 0 ? 'send' : 'mic';
}

export type Axis = 'none' | 'x' | 'y';
export type Drag = { x: number; y: number; dx: number; dy: number; axis: Axis; locked: boolean };

export function dragFrom(x: number, y: number): Drag {
  return { x, y, dx: 0, dy: 0, axis: 'none', locked: false };
}

export function dragTo(drag: Drag, pageX: number, pageY: number): Drag {
  if (drag.locked) return drag;
  const rawX = pageX - drag.x;
  const rawY = pageY - drag.y;
  let axis = drag.axis;
  if (axis === 'none' && Math.hypot(rawX, rawY) >= directionSlop) axis = Math.abs(rawX) >= Math.abs(rawY) ? 'x' : 'y';
  const dx = axis === 'x' ? Math.min(0, rawX) : 0;
  const dy = axis === 'y' ? Math.min(0, rawY) : 0;
  const locked = dy <= -lockDistance;
  return { ...drag, axis, dx, dy: locked ? 0 : dy, locked };
}

export function releaseOf(drag: Drag): 'keep' | 'cancel' | 'send' {
  if (drag.locked) return 'keep';
  return drag.dx <= -cancelDistance ? 'cancel' : 'send';
}

export function tooShort(durationMs: number): boolean {
  return durationMs < shortestVoiceMs;
}
