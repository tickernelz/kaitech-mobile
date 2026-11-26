import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { useChatFormat } from './format';
import { Icon } from '../../../ui/icons';
import { cancelDistance, type Recording, type useVoiceHold } from './useVoiceHold';
import { useBottomInset } from '../../../ui/insets';

export function RecordingStrip({ recording }: { recording: Recording }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { duration } = useChatFormat();
  const cancelling = recording.offset < -cancelDistance;
  return (
    <View style={styles.recording} accessibilityLiveRegion="polite" testID="voice-recording">
      <View style={[styles.dot, { backgroundColor: colors.danger }]} />
      <Text variant="headline">{duration(recording.elapsed)}</Text>
      <Text variant="callout" tone={cancelling ? 'dangerInk' : 'inkSoft'} style={[styles.flex, { transform: [{ translateX: recording.offset / 3 }] }]} numberOfLines={1}>
        {cancelling ? t('composer.releaseToCancel') : t('composer.slideToCancel')}
      </Text>
    </View>
  );
}

export function MicButton({ voice, hidden, testID = 'composer-mic' }: { voice: ReturnType<typeof useVoiceHold>; hidden: boolean; testID?: string }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const recording = voice.recording !== null;
  return (
    <View
      accessible={!hidden}
      accessibilityRole="button"
      accessibilityLabel={t('composer.recordVoice')}
      accessibilityHint={t('composer.holdToRecord')}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      testID={testID}
      style={[hidden ? styles.hidden : recording ? styles.recordButton : styles.round, { backgroundColor: recording ? colors.danger : colors.primary }]}
      {...voice.hold}>
      <Icon name="mic" color={recording ? colors.surface : colors.onPrimary} />
    </View>
  );
}

export function StagedFile({ name, mimetype, uri, onRemove }: { name: string; mimetype: string; uri?: string; onRemove: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  return (
    <View style={[styles.stagedFile, { backgroundColor: colors.surface2 }]} testID="staged-file">
      {uri && mimetype.startsWith('image/') ? (
        <Image source={{ uri }} style={styles.thumb} accessibilityIgnoresInvertColors testID="staged-thumb" />
      ) : (
        <Icon name={mimetype.startsWith('image/') ? 'image' : mimetype.startsWith('video/') ? 'video' : 'file'} size={20} color={colors.inkSoft} />
      )}
      <Text variant="footnote" numberOfLines={1} style={styles.stagedName}>
        {name}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('composer.removeFile', { name })} hitSlop={12} onPress={onRemove}>
        <Icon name="close" size={20} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}

export function UploadProgress({ name, sent, testID }: { name: string; sent: number; testID?: string }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const percent = Math.round(Math.min(1, Math.max(0, sent)) * 100);
  return (
    <View style={styles.progress} testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={t('composer.uploading', { name })} accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
        {t('composer.uploadingPercent', { name, percent })}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.lineStrong }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  recording: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingLeft: space.md, gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hidden: { width: 0, height: 44, overflow: 'hidden', opacity: 0 },
  recordButton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stagedFile: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, minHeight: 40, borderRadius: radius.md, maxWidth: 240 },
  stagedName: { flexShrink: 1 },
  thumb: { width: 32, height: 32, borderRadius: radius.sm },
  progress: { gap: space.xs, minWidth: 160 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
});
