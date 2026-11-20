import { useEffect } from 'react';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { conversations } from './api';
import { hasOpenConversation, openConversation } from './store';

export function useLatestConversation(programme: number) {
  const { active } = useSession();
  const list = useResource(programme ? `discovery.conversations.${programme}` : null, (account) => conversations(account, programme));
  useEffect(() => {
    if (!active || !programme || !list.data || hasOpenConversation(active.id, programme)) return;
    openConversation(active.id, programme, list.data[0]?.id ?? null);
  }, [active, programme, list.data]);
  return list;
}
