import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { chatClient } from '../../chat/chat';
import { Icon } from '../../../ui/icons';
import { playback, type Playback } from '../recording';

type Loaded = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; playback: Playback };

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => instance.play());
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" testID="recording-video" />;
}

export function RecordingPlayer({ id }: { id: number }) {
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    const client = chatClient();
    (client ? playback(client.account, id) : Promise.resolve(null))
      .catch(() => null)
      .then((answer) => live && setLoaded(answer ? { status: 'ready', playback: answer } : { status: 'failed' }));
    return () => {
      live = false;
    };
  }, [id]);

  const url = loaded.status === 'ready' ? loaded.playback.url : null;
  const audioOnly = loaded.status === 'ready' && loaded.playback.recording.audioOnly;

  return (
    <View style={[styles.fill, { backgroundColor: colors.stage, paddingTop: insets.top, paddingBottom: insets.bottom }]} testID="recording-player">
      <View style={styles.top}>
        <Text variant="title" numberOfLines={1} style={[styles.title, { color: colors.onStage }]}>
          {t('player.title')}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('player.close')} onPress={() => router.back()} style={styles.close} testID="recording-close">
          <Icon name="close" color={colors.onStage} />
        </Pressable>
      </View>
      <View style={styles.stage}>
        {loaded.status === 'loading' ? (
          <ActivityIndicator color={colors.onStage} />
        ) : url ? (
          <>
            <Player url={url} />
            {audioOnly ? (
              <Text variant="footnote" style={[styles.note, { color: colors.onStage }]}>
                {t('player.audioOnly')}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="body" style={[styles.note, { color: colors.onStage }]} testID="recording-unavailable">
            {t('player.unavailable')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  title: { flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  note: { textAlign: 'center', padding: space.md },
});
