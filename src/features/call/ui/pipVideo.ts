export type PipSize = { width: number; height: number };

export function pipVideo(size: PipSize | null | undefined) {
  if (!size) return undefined;
  return { enabled: true, startAutomatically: true, stopAutomatically: true, preferredSize: size };
}
