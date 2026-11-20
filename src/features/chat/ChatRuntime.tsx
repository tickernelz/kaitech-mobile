import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import type { Account } from '../../auth/oauth';
import { useLanguage } from '../../i18n';
import { routeForPush } from '../discovery/push';
import { startChat, stopChat } from './chat';
import { channelFromNotification, refreshPush } from './push';

let handled: string | null = null;

export function ChatRuntime({ account }: { account: Account | null }) {
  const router = useRouter();
  const { language } = useLanguage();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (account) startChat(account);
    else stopChat();
  }, [account]);

  useEffect(() => {
    if (account) void refreshPush(account.id);
  }, [account, language]);

  useEffect(() => {
    if (!account || !response) return;
    const id = response.notification.request.identifier;
    if (handled === id) return;
    handled = id;
    const channel = channelFromNotification(response);
    if (channel) {
      router.navigate({ pathname: '/', params: { channel: String(channel) } });
      return;
    }
    const target = routeForPush((response.notification.request.content.data ?? {}) as Record<string, unknown>);
    if (target) router.push(target);
  }, [account, response, router]);

  return null;
}
