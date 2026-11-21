import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Icon, type IconName } from '../../chat/ui/icons';

export type CallAction = 'mute' | 'camera' | 'flip' | 'share' | 'record' | 'speaker' | 'people' | 'pip' | 'hangup';

function Control({ icon, label, onPress, active, danger, busy, testID }: { icon: IconName; label: string; onPress: () => void; active?: boolean; danger?: boolean; busy?: boolean; testID: string }) {
  const { colors } = useTheme();
  const background = danger ? colors.danger : active ? colors.primary : colors.surface2;
  const ink = danger || active ? colors.onPrimary : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: Boolean(busy) }} disabled={busy} onPress={onPress} style={styles.control} testID={testID}>
      <View style={[styles.circle, { backgroundColor: background }]}>{busy ? <ActivityIndicator color={ink} /> : <Icon name={icon} size={24} color={ink} />}</View>
      <Text variant="label" tone="inkSoft" numberOfLines={1} style={styles.caption}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CallControls({
  vertical,
  video,
  muted,
  cameraOn,
  speaker,
  pip,
  share,
  sharing,
  recording,
  onAction,
}: {
  vertical: boolean;
  video: boolean;
  muted: boolean;
  cameraOn: boolean;
  speaker: boolean;
  pip: boolean;
  share: boolean;
  sharing: boolean;
  recording: { on: boolean; busy: boolean } | null;
  onAction: (action: CallAction) => void;
}) {
  const { t } = useTranslation('call');
  const items: { action: CallAction; icon: IconName; label: string; active?: boolean; danger?: boolean; busy?: boolean }[] = [
    { action: 'mute', icon: muted ? 'muted' : 'mic', label: muted ? t('unmute') : t('mute'), active: muted },
    ...(video ? [{ action: 'camera' as const, icon: 'camera' as const, label: cameraOn ? t('cameraTurnOff') : t('cameraOn'), active: !cameraOn }] : []),
    ...(video && cameraOn ? [{ action: 'flip' as const, icon: 'retry' as const, label: t('flip') }] : []),
    ...(share ? [{ action: 'share' as const, icon: 'screen' as const, label: sharing ? t('stopSharing') : t('shareScreen'), active: sharing }] : []),
    ...(recording
      ? [{ action: 'record' as const, icon: 'record' as const, label: recording.on ? t('stopRecording') : t('startRecording'), active: recording.on, busy: recording.busy }]
      : []),
    { action: 'speaker', icon: 'play', label: speaker ? t('earpiece') : t('speaker'), active: speaker },
    { action: 'people', icon: 'people', label: t('people') },
    ...(pip ? [{ action: 'pip' as const, icon: 'copy' as const, label: t('pictureInPicture') }] : []),
    { action: 'hangup', icon: 'close', label: t('hangUp'), danger: true },
  ];
  return (
    <View style={[styles.row, vertical ? styles.column : styles.wrap]} testID="call-controls">
      {items.map((item) => (
        <Control key={item.action} icon={item.icon} label={item.label} active={item.active} danger={item.danger} busy={item.busy} onPress={() => onAction(item.action)} testID={`call-${item.action}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  column: { flexDirection: 'column', justifyContent: 'center' },
  control: { alignItems: 'center', width: 64, gap: space.xs },
  circle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  caption: { textAlign: 'center' },
});
