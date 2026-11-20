import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import { onAccountForgotten } from '../../auth/session';
import i18n from '../../i18n';
import { chatClient, getChat } from './chat';
import { registeredKey, syncPushToken } from './pushAccount';

export const channelId = 'messages';
const askedKey = 'chat.pushAsked';
const store = { get: (key: string) => Storage.getItemSync(key), set: (key: string, value: string) => Storage.setItemSync(key, value) };

export const pushSupported = Platform.OS === 'android';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    const target = Number(data?.res_id);
    const open = data?.model === 'discuss.channel' && getChat().openChannels.includes(target);
    return { shouldShowBanner: !open, shouldShowList: !open, shouldPlaySound: !open, shouldSetBadge: false };
  },
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: i18n.t('chat:push.channel'),
    importance: AndroidImportance.HIGH,
  });
}

async function register(accountId: string) {
  const client = chatClient();
  if (!client || client.account.id !== accountId) return;
  await ensureChannel();
  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data !== 'string' || !token.data) return;
  await syncPushToken({
    store,
    account: client.account,
    token: token.data,
    language: i18n.language === 'id' ? 'id' : 'en',
    registerPush: (value, language) => client.registerPush(value, language),
  });
}

export async function refreshPush(accountId: string) {
  if (!pushSupported) return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) await register(accountId);
  } catch {
    return;
  }
}

export async function askForPushOnce(accountId: string) {
  if (!pushSupported || Storage.getItemSync(askedKey) === '1') return;
  Storage.setItemSync(askedKey, '1');
  try {
    await ensureChannel();
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.granted) await register(accountId);
  } catch {
    return;
  }
}

onAccountForgotten((accountId) => {
  if (Storage.getItemSync(registeredKey)?.startsWith(`${accountId}|`)) Storage.removeItemSync(registeredKey);
});

export function pushData(response: Notifications.NotificationResponse | null): Record<string, unknown> {
  return (response?.notification.request.content.data ?? {}) as Record<string, unknown>;
}

export function channelFromNotification(data: Record<string, unknown>): number | null {
  if (data.model !== 'discuss.channel') return null;
  const id = Number(data.res_id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
