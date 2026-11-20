import type { TranscriptItem } from './api';

export type Entry =
  | { kind: 'request'; id: string; item: TranscriptItem }
  | { kind: 'reply'; id: string; item: TranscriptItem }
  | { kind: 'steps'; id: string; steps: TranscriptItem[] }
  | { kind: 'failure'; id: string; item: TranscriptItem };

const stepKinds = new Set(['tool_call', 'tool_result']);

export function idOf(item: TranscriptItem): string {
  return `${item.turnId}:${item.seq}`;
}

export function mergeItems(current: TranscriptItem[], incoming: TranscriptItem[]): TranscriptItem[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map(idOf));
  const added = incoming.filter((item) => !seen.has(idOf(item)));
  if (!added.length) return current;
  return [...current, ...added].sort((a, b) => a.turnId - b.turnId || a.seq - b.seq);
}

export function entriesOf(items: TranscriptItem[]): Entry[] {
  const entries: Entry[] = [];
  for (const item of items) {
    if (item.kind === 'request') entries.push({ kind: 'request', id: idOf(item), item });
    else if (item.kind === 'failure') entries.push({ kind: 'failure', id: idOf(item), item });
    else if (item.kind === 'message' && item.body.trim()) entries.push({ kind: 'reply', id: idOf(item), item });
    else if (stepKinds.has(item.kind)) {
      const last = entries.at(-1);
      if (last?.kind === 'steps' && last.steps[0].turnId === item.turnId) last.steps.push(item);
      else entries.push({ kind: 'steps', id: idOf(item), steps: [item] });
    }
  }
  return entries;
}

export function stepLine(steps: TranscriptItem[]): string {
  const said = [...steps].reverse().find((step) => step.intention?.trim());
  return said?.intention?.trim() ?? steps.at(-1)?.name ?? '';
}

export function stepCount(steps: TranscriptItem[]): number {
  return steps.filter((step) => step.kind === 'tool_call').length || steps.length;
}
