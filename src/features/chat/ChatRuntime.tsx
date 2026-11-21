import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { Account } from '../../auth/oauth';
import { getSession, switchAccount } from '../../auth/session';
import { useLanguage } from '../../i18n';
import { callNative, onMessageOpen, type MessageOpen } from '../call/native';
import { routeForPush } from '../discovery/push';
import { startChat, stopChat, useChat } from './chat';
import { mirrorLanguage, mirrorMuted, mirrorOpen } from './notify';
import { channelFromNotification, pushData, refreshPush } from './push';
import { accountForPush } from './pushAccount';
import { refreshProfile } from '../profile/profile';

let handled: string | null = null;
let waitingOpen: MessageOpen | null = null;

export function ChatRuntime({ account }: { account: Account | null }) {
  const router = useRouter();
  const { language } = useLanguage();
  const response = Notifications.useLastNotificationResponse();
  const openChannels = useChat((state) => state.openChannels);
  const conversations = useChat((state) => state.conversations);
  const chatAccount = useChat((state) => state.accountId);

  useEffect(() => {
    if (account) startChat(account);
    else stopChat();
  }, [account]);

  const accountId = account?.id ?? null;
  useEffect(() => {
    const current = getSession().accounts.find((item) => item.id === accountId);
    if (current) void refreshProfile(current);
  }, [accountId]);

  useEffect(() => {
    if (account) void refreshPush(account.id);
  }, [account, language]);

  useEffect(() => {
    mirrorLanguage(language);
  }, [language]);

  useEffect(() => {
    mirrorOpen(account && chatAccount === account.id ? account : null, openChannels);
  }, [account, chatAccount, openChannels]);

  useEffect(() => {
    if (account && chatAccount === account.id) mirrorMuted(account, conversations);
  }, [account, chatAccount, conversations]);

  useEffect(() => {
    if (!account) return;
    const go = (open: MessageOpen) => {
      const session = getSession();
      const target = accountForPush({ db: open.db, uid: open.uid }, session.accounts, session.activeId);
      if (!target) {
        router.navigate('/');
        return;
      }
      if (target.switchTo) {
        waitingOpen = open;
        switchAccount(target.accountId);
        return;
      }
      router.navigate({ pathname: '/', params: { channel: String(open.channelId) } });
    };
    const take = async () => {
      const open = waitingOpen ?? (await callNative()?.takeMessageOpen().catch(() => null)) ?? null;
      waitingOpen = null;
      if (open && open.channelId > 0) go(open);
    };
    void take();
    const stopListening = onMessageOpen(() => void take());
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void take();
    });
    return () => {
      stopListening();
      subscription.remove();
    };
  }, [account, router]);

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
