import type { Href } from 'expo-router';

type PushData = Record<string, unknown>;

function idOf(value: unknown): string | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0 ? String(parsed) : null;
}

export function routeForPush(data: PushData): Href | null {
  const programme = idOf(data.engagement_id);
  const target = idOf(data.res_id);
  if (!programme || !target) return null;
  if (data.type === 'discovery_card' || data.type === 'discovery_card_restated') {
    const conversation = idOf(data.conversation_id);
    return {
      pathname: '/program/card/[id]',
      params: { id: target, programme, ...(conversation ? { conversation } : {}) },
    };
  }
  if (data.type === 'discovery_answer') {
    return { pathname: '/program/[id]/coworker', params: { id: programme, conversation: target } };
  }
  return null;
}
