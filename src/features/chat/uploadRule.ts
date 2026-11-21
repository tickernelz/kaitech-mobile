export type UploadKind = 'chat' | 'coworker';
export type Limits = Partial<Record<UploadKind, number>>;

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
