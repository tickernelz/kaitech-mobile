export const cancelDistance = 96;
export const lockDistance = 72;

export type SendMode = 'mic' | 'send' | 'voice';

export function sendModeOf({ text, files, locked }: { text: string; files: number; locked: boolean }): SendMode {
  if (locked) return 'voice';
  return text.trim().length > 0 || files > 0 ? 'send' : 'mic';
}

export type Drag = { x: number; y: number; dx: number; dy: number; locked: boolean };

export function dragTo(drag: Drag, pageX: number, pageY: number): Drag {
  if (drag.locked) return drag;
  const dx = Math.min(0, pageX - drag.x);
  const dy = Math.min(0, pageY - drag.y);
  const sideways = dx < dy;
  const locked = !sideways && dy < -lockDistance;
  return { ...drag, dx: sideways ? dx : 0, dy: locked || sideways ? 0 : dy, locked };
}

export function releaseOf(drag: Drag): 'keep' | 'cancel' | 'send' {
  if (drag.locked) return 'keep';
  return drag.dx < -cancelDistance ? 'cancel' : 'send';
}
