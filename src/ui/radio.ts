export type RadioGeometry = { ring: number; border: number; dot: number };

const target: RadioGeometry = { ring: 22, border: 2, dot: 10 };

export function radioGeometry(scale: number): RadioGeometry {
  const ring = Math.round(target.ring * scale);
  const border = Math.max(1, Math.round(target.border * scale));
  const nearest = Math.round(target.dot * scale);
  const dot = (ring - 2 * border - nearest) % 2 === 0 ? nearest : nearest - 1;
  return { ring: ring / scale, border: border / scale, dot: dot / scale };
}
