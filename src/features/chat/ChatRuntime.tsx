import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import type { Account } from '../../auth/oauth';
import { getSession, switchAccount } from '../../auth/session';
import { useLanguage } from '../../i18n';
import { routeForPush } from '../discovery/push';
import { startChat, stopChat } from './chat';
import { channelFromNotification, pushData, refreshPush } from './push';
import { accountForPush } from './pushAccount';

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
    const data = pushData(response);
    const session = getSession();
    const target = accountForPush(data, session.accounts, session.activeId);
    if (!target) {
      router.navigate('/');
      return;
    }
    if (target.switchTo) {
      switchAccount(target.accountId);
      handled = null;
      return;
    }
    const channel = channelFromNotification(data);
    if (channel) {
      router.navigate({ pathname: '/', params: { channel: String(channel) } });
      return;
    }
    const route = routeForPush(data);
    if (route) router.push(route);
  }, [account, response, router]);

  return null;
}
