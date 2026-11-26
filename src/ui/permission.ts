import { Linking } from 'react-native';
import i18n from '../i18n';
import { confirm } from './dialog';
import type { IconName } from './icons';

export type PermissionKind = 'camera' | 'microphone' | 'notifications' | 'location';
export type PermissionState = { granted: boolean; canAskAgain: boolean };

const icons: Record<PermissionKind, IconName> = { camera: 'photo', microphone: 'mic', notifications: 'bell', location: 'location' };

export async function offerSettings(kind: PermissionKind): Promise<void> {
  const open = await confirm({
    title: i18n.t(`permission.${kind}.blockedTitle`),
    body: i18n.t(`permission.${kind}.blockedBody`),
    confirm: i18n.t('permission.openSettings'),
    cancel: i18n.t('permission.notNow'),
    icon: icons[kind],
    testID: `permission-${kind}-blocked-dialog`,
  });
  if (open) await Linking.openSettings();
}

export async function askPermission(
  kind: PermissionKind,
  read: () => Promise<PermissionState>,
  request: () => Promise<PermissionState>,
  { settings = true }: { settings?: boolean } = {},
): Promise<boolean> {
  const now = await read();
  if (now.granted) return true;
  if (!now.canAskAgain) {
    if (settings) await offerSettings(kind);
    return false;
  }
  const go = await confirm({
    title: i18n.t(`permission.${kind}.title`),
    body: i18n.t(`permission.${kind}.body`),
    confirm: i18n.t('permission.continue'),
    cancel: i18n.t('permission.notNow'),
    icon: icons[kind],
    testID: `permission-${kind}-dialog`,
  });
  if (!go) return false;
  return (await request()).granted;
}
