import type { IconName } from '../../ui/icons';

export function sourceIcon(kind: string): IconName {
  if (kind === 'interview') return 'mic';
  if (kind === 'meeting') return 'meeting';
  if (kind === 'consultant') return 'chat';
  return 'doc';
}

export const sourceKinds = ['document', 'interview', 'consultant', 'legacy', 'prototype', 'meeting'] as const;

export function sourceLabelKey(kind: string): string {
  return (sourceKinds as readonly string[]).includes(kind) ? `discovery.source.${kind}` : 'discovery.source.other';
}
