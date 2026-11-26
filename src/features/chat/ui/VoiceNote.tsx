import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Pressable } from '../../../ui/Pressable';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { bucketsOf } from '../voice/levels';
import { closeVoice, cycleVoiceRate, seekVoice, seekVoiceFraction, toggleVoice, usePlayed, useVoice, type VoiceMeta } from '../voicePlayer';
import { useChatFormat } from './format';
import { Icon } from '../../../ui/icons';
import { useCookie } from './useCookie';
import { reach } from '../../../ui/touch';

const seedBars = 28;
const barPitch = 5;
const barWidth = 3;
const waveHeight = 32;
const seekStepMs = 5000;
const playSize = 40;
const rateWidth = 40;
const rateHeight = 28;
const rateSlop = reach(rateHeight, rateWidth);

export function seededLevels(seed: number): number[] {
  let value = seed * 2654435761;
  return Array.from({ length: seedBars }, () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return 0.25 + (value % 1000) / 1333;
  });
}

function barPath(levels: number[], from: number, to: number): string {
  let d = '';
  for (let index = from; index < to; index++) {
    const height = Math.max(barWidth, 3 + (waveHeight - 3) * Math.min(1, Math.max(0, levels[index])) - barWidth);
    const top = (waveHeight - height) / 2;
    const x = index * barPitch + barWidth / 2;
    d += `M${x.toFixed(1)} ${top.toFixed(1)}V${(top + height).toFixed(1)}`;
  }
  return d;
}

export const VoiceNote = memo(function VoiceNote({
  id,
  uri,
  mine,
  seed,
  waveform = null,
  durationMs = null,
  meta,
}: {
  id: string;
  uri: string;
  mine: boolean;
  seed: number;
  waveform?: number[] | null;
  durationMs?: number | null;
  meta?: VoiceMeta;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { duration } = useChatFormat();
  const voice = useVoice();
  const played = usePlayed(id);
  const cookie = useCookie() ?? undefined;
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const current = voice.id === id;
  const playing = current && voice.playing;
  const total = current && voice.duration > 0 ? voice.duration : (durationMs ?? 0);
  const fraction = dragging ?? (current && total > 0 ? voice.position / total : 0);
  const levels = bucketsOf(waveform ? waveform.map((value) => value / 255) : seededLevels(seed), Math.max(0, Math.floor(width / barPitch)));
  const cut = Math.round(fraction * levels.length);
  const fromX = (x: number) => (width > 0 ? Math.min(1, Math.max(0, x / width)) : 0);
  const seekTo = (part: number) => void seekVoiceFraction(id, uri, part, cookie, meta);
  const time = current ? `${duration(voice.position)} / ${duration(total)}` : total > 0 ? duration(total) : t('voice.label');
  return (
    <View style={[styles.row, { backgroundColor: mine ? colors.surface : colors.surface2 }]} testID={`voice-${id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? t('voice.pause') : t('voice.play')}
        onPress={() => void toggleVoice(id, uri, cookie, meta)}
        hitSlop={reach(playSize, playSize)}
        testID={`voice-toggle-${id}`}
        style={({ pressed }) => [styles.play, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name={playing ? 'pause' : 'play'} color={colors.onPrimary} />
      </Pressable>
      <View style={styles.flex}>
        <View
          style={styles.wave}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('voice.position')}
          accessibilityValue={{ text: time }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const step = event.nativeEvent.actionName === 'increment' ? seekStepMs : -seekStepMs;
            if (current && total > 0) void seekVoice(id, uri, Math.min(total, Math.max(0, voice.position + step)), cookie);
            else if (total > 0) seekTo(Math.max(0, step) / total);
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => setDragging(fromX(event.nativeEvent.locationX))}
          onResponderMove={(event) => setDragging(fromX(event.nativeEvent.locationX))}
          onResponderRelease={(event) => {
            seekTo(fromX(event.nativeEvent.locationX));
            setDragging(null);
          }}
          onResponderTerminate={() => setDragging(null)}
          testID={`voice-wave-${id}`}>
          {width > 0 ? (
            <Svg width={width} height={waveHeight}>
              <Path d={barPath(levels, 0, cut)} stroke={colors.primary} strokeWidth={barWidth} strokeLinecap="round" />
              <Path d={barPath(levels, cut, levels.length)} stroke={colors.lineStrong} strokeWidth={barWidth} strokeLinecap="round" />
            </Svg>
          ) : null}
        </View>
        <View style={styles.meta}>
          <Text variant="label" tone="inkSoft" style={styles.regular}>
            {time}
          </Text>
          {!mine && !played ? <View style={[styles.unplayed, { backgroundColor: colors.primary }]} accessibilityLabel={t('voice.unplayed')} testID={`voice-unplayed-${id}`} /> : null}
        </View>
      </View>
      {current ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('voice.speed', { rate: voice.rate })} onPress={cycleVoiceRate} hitSlop={rateSlop} style={[styles.rate, { borderColor: colors.line }]} testID={`voice-rate-${id}`}>
          <Text variant="label">{`${voice.rate}\u00d7`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

export function VoiceMiniBar({ hideFor }: { hideFor?: number | null }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { duration } = useChatFormat();
  const router = useRouter();
  const voice = useVoice();
  const meta = voice.meta;
  if (!voice.id || !meta || (hideFor !== undefined && hideFor === meta.channelId)) return null;
  return (
    <View style={[styles.mini, { backgroundColor: colors.surface, borderBottomColor: colors.line }]} testID="voice-mini-bar">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={voice.playing ? t('voice.pause') : t('voice.play')}
        onPress={() => void toggleVoice(voice.id as string, '')}
        style={styles.miniButton}
        testID="voice-mini-toggle">
        <Icon name={voice.playing ? 'pause' : 'play'} color={colors.primary} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('voice.openChat', { name: meta.title })}
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: String(meta.channelId), ...(meta.messageId ? { message: String(meta.messageId) } : {}) } })}
        style={styles.miniTitle}
        testID="voice-mini-open">
        <Text variant="callout" numberOfLines={1} style={styles.flexShrink}>
          {meta.title}
        </Text>
        <Text variant="label" tone="inkSoft" style={styles.regular}>
          {duration(voice.position)}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('voice.speed', { rate: voice.rate })} onPress={cycleVoiceRate} hitSlop={rateSlop} style={[styles.rate, { borderColor: colors.line }]} testID="voice-mini-rate">
        <Text variant="label">{`${voice.rate}\u00d7`}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('voice.close')} onPress={closeVoice} style={styles.miniButton} testID="voice-mini-close">
        <Icon name="close" color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  regular: { fontWeight: '400', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, minWidth: 252 },
  play: { width: playSize, height: playSize, borderRadius: playSize / 2, alignItems: 'center', justifyContent: 'center' },
  wave: { height: waveHeight, justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  unplayed: { width: 8, height: 8, borderRadius: 4 },
  rate: { minWidth: rateWidth, minHeight: rateHeight, paddingHorizontal: space.xs, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44, paddingHorizontal: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  miniButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  miniTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
});
