import { useChat } from './chat';
import { unreadCount } from './listFilters';

export function useUnreadConversations(): number {
  return useChat((state) => unreadCount(state.conversations));
}
