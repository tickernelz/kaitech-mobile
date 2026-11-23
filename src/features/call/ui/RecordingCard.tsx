import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { chatClient } from '../../chat/chat';
import { Icon } from '../../../ui/icons';
import { playback, type Recording } from '../recording';

type Loaded = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; recording: Recording };

export function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

export function RecordingCard({ recordingId, mine }: { recordingId: number; mine: boolean }) {
  const { t, i18n } = useTranslation('call');
  const { colors } = useTheme();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const client = chatClient();
    (client ? playback(client.account, recordingId) : Promise.resolve(null))
      .catch(() => null)
      .then((answer) => live && setLoaded(answer ? { status: 'ready', recording: answer.recording } : { status: 'failed' }));
    return () => {
      live = false;
    };
  }, [recordingId, attempt]);

  const retry = () => {
    setLoaded({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  const day = (date: Date) => date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const recording = loaded.status === 'ready' ? loaded.recording : null;
  const playable = recording?.state === 'done';
  const title = recording?.audioOnly ? t('recordingCard.audio') : t('recordingCard.video');
  const detail =
    loaded.status === 'loading'
      ? t('recordingCard.loading')
      : loaded.status === 'failed' || !recording
        ? t('recordingCard.unavailable')
        : recording.state === 'deleted'
          ? recording.deletedAt
            ? t('recordingCard.deletedOn', { date: day(recording.deletedAt) })
            : t('recordingCard.deleted')
          : recording.state === 'failed'
            ? t('recordingCard.failed')
            : recording.state !== 'done'
              ? t('recordingCard.saving')
              : [recording.duration !== null ? clock(recording.duration) : '', recording.expiresAt ? t('recordingCard.deletesOn', { date: day(recording.expiresAt) }) : '']
                  .filter(Boolean)
                  .join(' · ');

  const onPress = () => {
    if (playable) router.push({ pathname: '/recording/[id]', params: { id: String(recordingId) } });
    else if (loaded.status === 'failed') retry();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityState={{ disabled: !playable && loaded.status !== 'failed', busy: loaded.status === 'loading' }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: mine ? colors.surface : colors.surface2, opacity: pressed ? 0.8 : 1 }]}
      testID={`recording-card-${recordingId}`}>
      <View style={[styles.icon, { backgroundColor: playable ? colors.primary : colors.surface2 }]}>
        {loaded.status === 'loading' ? (
          <ActivityIndicator color={colors.inkSoft} />
        ) : (
          <Icon name={playable ? 'play' : recording?.state === 'deleted' ? 'trash' : loaded.status === 'failed' ? 'retry' : 'record'} color={playable ? colors.onPrimary : colors.inkSoft} />
        )}
      </View>
      <View style={styles.text}>
        <Text variant="callout" numberOfLines={1} style={styles.bold}>
          {title}
        </Text>
        <Text variant="footnote" tone="inkSoft" numberOfLines={2} testID={`recording-card-${recordingId}-detail`}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: 14, minHeight: 56, minWidth: 220 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
});
