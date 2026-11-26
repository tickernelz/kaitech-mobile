const playPath = /^\/kaitech_mobile\/call\/recordings\/(\d+)\/play$/;

export function recordingIdOf(url: string | null | undefined): number | null {
  const match = url ? playPath.exec(url) : null;
  return match ? Number(match[1]) : null;
}
