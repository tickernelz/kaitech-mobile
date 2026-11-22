import * as Clipboard from 'expo-clipboard';
import type { TFunction } from 'i18next';
import { Share } from 'react-native';
import type { SheetAction } from './ActionSheet';

export function textActions(t: TFunction, text: string): SheetAction[] {
  return [
    { key: 'copy', icon: 'copy', label: t('row.copy'), onPress: () => void Clipboard.setStringAsync(text) },
    { key: 'share', icon: 'share', label: t('row.share'), onPress: () => void Share.share({ message: text }).catch(() => undefined) },
  ];
}
