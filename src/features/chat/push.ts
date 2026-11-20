import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import i18n from '../../i18n';
import { chatClient, getChat } from './chat';

export const channelId = 'messages';
const askedKey = 'chat.pushAsked';
const registeredKey = 'chat.pushRegistered';

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
  const marker = `${accountId}|${token.data}|${i18n.language}`;
  if (Storage.getItemSync(registeredKey) === marker) return;
  await client.registerPush(token.data, i18n.language === 'id' ? 'id' : 'en');
  Storage.setItemSync(registeredKey, marker);
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

export function forgetPushRegistration() {
  Storage.removeItemSync(registeredKey);
}

export function channelFromNotification(response: Notifications.NotificationResponse | null): number | null {
  const data = response?.notification.request.content.data as Record<string, unknown> | undefined;
  if (data?.model !== 'discuss.channel') return null;
  const id = Number(data.res_id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
