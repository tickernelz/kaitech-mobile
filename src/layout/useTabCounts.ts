import { useMemo } from 'react';
import { usePendingActivities } from '../features/activity/useActivityOverview';
import { useUnreadConversations } from '../features/chat/unread';
import type { TabName } from './tabs';

export function useTabCounts(): Record<TabName, number> {
  const chat = useUnreadConversations();
  const activity = usePendingActivities();
  return useMemo(() => ({ home: 0, chat, discovery: 0, mom: 0, activity }), [chat, activity]);
}
