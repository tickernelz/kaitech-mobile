import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useWindowClass } from '../../layout/windowClass';
import { getChat } from '../../features/chat/chat';
import { selectChannel } from '../../features/chat/selection';
import { ThreadView } from '../../features/chat/ui/ThreadView';

export default function ChatThread() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; message?: string }>();
  const id = Number(params.id);
  const message = Number(params.message);
  const { windowClass } = useWindowClass();
  const expanded = windowClass === 'expanded';
  const expandedRef = useRef(expanded);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);
  const topLevel = getChat().conversations.some((conversation) => conversation.id === id);

  useEffect(() => {
    selectChannel(id);
    return () => {
      if (!expandedRef.current) selectChannel(null);
    };
  }, [id]);

  useEffect(() => {
    if (expanded && topLevel && router.canGoBack()) router.back();
  }, [expanded, topLevel, router]);

  if (!Number.isInteger(id) || id <= 0) return null;
  return (
    <ThreadView
      channelId={id}
      twoPane={false}
      focusMessage={Number.isInteger(message) && message > 0 ? message : null}
      onOpenChannel={(next) => router.push({ pathname: '/chat/[id]', params: { id: String(next) } })}
    />
  );
}
