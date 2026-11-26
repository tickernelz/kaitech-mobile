import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const quietly = (work: () => Promise<unknown>) => void work().catch(() => undefined);

export const haptic = {
  start: () => quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  tick: () => quietly(() => Haptics.selectionAsync()),
  lock: () => quietly(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))),
  reject: () => quietly(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))),
  error: () => quietly(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))),
  send: () => quietly(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))),
};
