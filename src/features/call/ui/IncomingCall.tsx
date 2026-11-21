import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Avatar } from '../../chat/ui/Avatar';
import { Icon } from '../../../ui/icons';
import { answer, decline, useCallState } from '../call';

export function IncomingCall() {
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const call = useCallState();
  if (call.phase !== 'incoming') return null;

  return (
    <View style={[styles.fill, { backgroundColor: colors.canvas, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]} testID="incoming-call">
      <View style={styles.who}>
        <Avatar name={call.callerName} seed={call.callerPartnerId ?? 0} size={96} />
        <Text variant="title" numberOfLines={2} style={styles.center} testID="incoming-name">
          {call.callerName}
        </Text>
        <Text variant="callout" tone="inkSoft" style={styles.center}>
          {call.video ? t('incoming.video') : t('incoming.voice')}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('decline')} onPress={() => void decline()} style={[styles.round, { backgroundColor: colors.danger }]} testID="incoming-decline">
          <Icon name="phoneEnd" size={32} color={colors.onPrimary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('answer')} onPress={() => void answer()} style={[styles.round, { backgroundColor: colors.ok }]} testID="incoming-answer">
          <Icon name={call.video ? 'video' : 'phone'} size={32} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'space-between', zIndex: 40, elevation: 40 },
  who: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: space.xl },
  round: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
});
