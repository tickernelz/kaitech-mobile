import type { Conversation } from './types';

export type Filter = 'all' | 'unread' | 'mention' | 'people' | 'rooms' | 'agent';
const baseFilters: Filter[] = ['all', 'unread', 'people', 'rooms'];

export function listFilters(chatFilters: boolean, agents: boolean): Filter[] {
  if (!chatFilters) return baseFilters;
  return ['all', 'unread', 'mention', 'people', 'rooms', ...(agents ? (['agent'] as const) : [])];
}

export function matches(conversation: Conversation, filter: Filter): boolean {
  if (filter === 'unread') return conversation.unread > 0;
  if (filter === 'mention') return conversation.mentioned === true;
  if (filter === 'agent') return conversation.agent === true;
  if (filter === 'people') return conversation.type === 'chat';
  if (filter === 'rooms') return conversation.type !== 'chat';
  return true;
}
