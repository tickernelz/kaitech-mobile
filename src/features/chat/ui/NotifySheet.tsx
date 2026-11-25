import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Modal } from '../../../ui/Modal';
import { Pressable } from '../../../ui/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../../auth/session';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { muteConversation } from '../chat';
import type { Notifications } from '../odoo';
import { setNotifications } from '../threadActions';
import { bubbleSettingsAvailable, muteChoices, mutedForever, mutedUntilMs, openBubbleSettings } from '../notify';
import { Icon, type IconName } from '../../../ui/icons';

export function NotifySheet({
  channelId,
  mutedUntil,
  notifications,
  onClose,
  onBackground,
}: {
  channelId: number;
  mutedUntil: string | null;
  notifications?: Notifications;
  onClose: () => void;
  onBackground?: () => void;
}) {
  const { t, i18n } = useTranslation('chat');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const until = mutedUntilMs(mutedUntil, now);
  const choose = (minutes: number) => async () => {
    setBusy(true);
    setFailed(null);
    const failure = await muteConversation(channelId, minutes);
    setBusy(false);
    if (failure) setFailed(failure);
    else onClose();
  };
  const account = useSession().active;
  const level = (value: Notifications) => async () => {
    setBusy(true);
    setFailed(null);
    const result = await setNotifications(channelId, value);
    setBusy(false);
    if (!result.ok) setFailed(result.code);
    else onClose();
  };
  const items: { icon: IconName; label: string; onPress: () => void; testID: string }[] = until
    ? [{ icon: 'bell', label: t('notify.unmute'), onPress: choose(0), testID: 'notify-unmute' }]
    : muteChoices.map((choice) => ({ icon: 'bellOff', label: t(`notify.mute.${choice.key}`), onPress: choose(choice.minutes), testID: `notify-mute-${choice.key}` }));
  if (notifications !== undefined && !until) {
    for (const value of ['all', 'mentions', 'no_notif'] as const) {
      items.push({ icon: value === 'no_notif' ? 'bellOff' : 'bell', label: t(`notify.level.${value}`) + (notifications === value ? ' \u2713' : ''), onPress: level(value), testID: `notify-level-${value}` });
    }
  }
  if (account && bubbleSettingsAvailable()) {
    items.push({
      icon: 'thread',
      label: t('notify.bubble'),
      onPress: () => {
        onClose();
        openBubbleSettings(account, channelId);
      },
      testID: 'notify-bubble',
    });
  }
  if (onBackground) {
    items.push({
      icon: 'image',
      label: t('thread.background'),
      onPress: () => {
        onClose();
        onBackground();
      },
      testID: 'notify-background',
    });
  }
  const status = until ? (mutedForever(mutedUntil, now) ? t('notify.mutedAlways') : t('notify.mutedUntil', { time: new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(until) })) : null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('actions.close')}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => undefined} accessibilityViewIsModal testID="notify-sheet">
          <Text variant="headline" accessibilityRole="header" style={styles.title}>
            {t('notify.title')}
          </Text>
          {status ? (
            <Text variant="footnote" tone="inkSoft" style={styles.title}>
              {status}
            </Text>
          ) : null}
          {items.map((item) => (
            <Pressable key={item.testID} accessibilityRole="button" disabled={busy} onPress={item.onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface2 }]} testID={item.testID}>
              <Icon name={item.icon} color={colors.ink} />
              <Text variant="body" style={styles.flex}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          <View style={styles.foot}>
            {busy ? <ActivityIndicator color={colors.primary} /> : null}
            {failed ? (
              <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID={`notify-failed-${failed}`}>
                {t(failed === 'network' ? 'notify.failedNetwork' : 'notify.failed')}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg, gap: space.xs },
  title: { paddingHorizontal: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.sm, borderRadius: radius.md },
  foot: { minHeight: space.lg, alignItems: 'center', justifyContent: 'center' },
});
