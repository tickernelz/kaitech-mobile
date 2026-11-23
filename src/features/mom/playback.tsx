import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { playbackUrl } from './api';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { IconButton } from '../../ui/IconButton';
import { Icon } from '../../ui/icons';
import { Text } from '../../ui/Text';
import { clock } from './recorder';

async function loaded(player: AudioPlayer): Promise<boolean> {
  for (let tries = 0; tries < 100; tries++) {
    if (player.isLoaded) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

export function usePlayback(recording: number | null) {
  const { active } = useSession();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const source = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const play = useCallback(
    async (seconds?: number) => {
      if (!active || !recording) return;
      setBusy(true);
      try {
        if (source.current !== recording) {
          player.replace({ uri: await playbackUrl(active, recording) });
          source.current = recording;
          if (!(await loaded(player))) return;
        }
        if (seconds !== undefined) await player.seekTo(seconds);
        player.play();
      } catch {
        source.current = null;
      } finally {
        setBusy(false);
      }
    },
    [active, recording, player],
  );
  const seekBy = useCallback(
    (delta: number) => {
      if (source.current !== recording) return;
      void player.seekTo(Math.max(0, player.currentTime + delta));
    },
    [player, recording],
  );
  return { status, play, pause: () => player.pause(), seekBy, busy };
}

export function PlayerBar({ playback, skip = false }: { playback: ReturnType<typeof usePlayback>; skip?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { status } = playback;
  const share = status.duration ? Math.min(1, status.currentTime / status.duration) : 0;
  return (
    <View style={styles.playerWrap}>
    <View style={[styles.player, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="mom-player">
      {skip ? <IconButton icon="back" label={t('mom.detail.back10')} onPress={() => playback.seekBy(-10)} testID="player-back" /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('mom.detail.pause') : t('mom.detail.play')}
        onPress={() => (status.playing ? playback.pause() : void playback.play())}
        disabled={playback.busy}
        style={[styles.playButton, { backgroundColor: colors.primary, opacity: playback.busy ? 0.6 : 1 }]}
        testID="player-toggle">
        <Icon name={status.playing ? 'pause' : 'play'} color={colors.onPrimary} />
      </Pressable>
      {skip ? <IconButton icon="forward" label={t('mom.detail.forward10')} onPress={() => playback.seekBy(10)} testID="player-forward" /> : null}
      <View style={[styles.track, { backgroundColor: colors.line }]}>
        <View style={[styles.trackFill, { backgroundColor: colors.primary, width: `${Math.round(share * 100)}%` }]} />
      </View>
      <Text variant="footnote" style={styles.mono}>
        {clock(status.currentTime * 1000)}
      </Text>
    </View>
    </View>
  );
}


const styles = StyleSheet.create({
  mono: { fontVariant: ['tabular-nums'] },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    paddingRight: space.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: readableWidth,
  },
  playerWrap: { paddingHorizontal: space.md, paddingVertical: space.sm, alignItems: 'center' },
  playButton: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  trackFill: { height: 6 },
});
