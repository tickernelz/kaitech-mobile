export type UploadKind = 'chat' | 'coworker';
export type Limits = Partial<Record<UploadKind, number>>;

export const coworkerFallbackBytes = 25 * 1024 * 1024;

export function withinBudget<T extends { size: number }>(held: readonly { size: number }[], incoming: readonly T[], maxBytes: number): { kept: T[]; refused: T[] } {
  let used = held.reduce((sum, file) => sum + file.size, 0);
  const kept: T[] = [];
  const refused: T[] = [];
  for (const file of incoming) {
    if (used + file.size > maxBytes) {
      refused.push(file);
    } else {
      kept.push(file);
      used += file.size;
    }
  }
  return { kept, refused };
}

export function limitsOf(body: unknown): Limits {
  const limits: Limits = {};
  if (!body || typeof body !== 'object') return limits;
  for (const kind of ['chat', 'coworker'] as const) {
    const rule = (body as Record<string, unknown>)[kind];
    const most = rule && typeof rule === 'object' ? (rule as Record<string, unknown>).max_bytes : undefined;
    if (typeof most === 'number' && Number.isInteger(most) && most > 0) limits[kind] = most;
  }
  return limits;
}
