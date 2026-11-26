import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { radius, space, useTheme } from '../../../../theme';
import { duration as motion, easing } from '../../../../theme/motion';
import { Icon, type IconName } from '../../../../ui/icons';
import { trashLidHinge } from '../../../../ui/icons/glyphs';
import { Pressable } from '../../../../ui/Pressable';
import { Text } from '../../../../ui/Text';
import { bucketsOf } from '../../voice/levels';
import type { Interruption } from '../../voice/machine';
import { seekVoice, toggleVoice, useVoice } from '../../voicePlayer';
import { useChatFormat } from '../format';
import { buttonSize } from './Controls';
import { cancelDistance } from './gesture';
import { useVoiceClock, voiceLimitMs, voiceWarnMs, type ClockStore } from '../../voice/clock';
import type { VoiceRecorder } from './useVoiceRecorder';
import { reach } from '../../../../ui/touch';

const barPitch = 5;
const barWidth = 3;
const barMin = 3;
const barMax = 32;
const seekStepMs = 5000;
const trashIcon = 24;
const draftPlaySize = 36;

export function voiceRowPhase(voice: VoiceRecorder): 'held' | 'locked' | 'paused' | null {
  const state = voice.state;
  if (state.phase === 'paused') return 'paused';
  if (state.phase === 'pressing' || state.phase === 'recording') return state.locked ? 'locked' : 'held';
  return null;
}

export function VoiceRow({ voice, channelId }: { voice: VoiceRecorder; channelId: number }) {
  const phase = voiceRowPhase(voice);
  if (phase === 'paused') return <PausedRow voice={voice} channelId={channelId} />;
  if (phase === 'locked') return <LockedRow voice={voice} />;
  if (phase === 'held') return <HeldRow voice={voice} />;
  return null;
}

function RoundAction({ icon, label, color, onPress, testID }: { icon: IconName; label: string; color: string; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={2} style={styles.action} testID={testID}>
      <Icon name={icon} color={color} />
    </Pressable>
  );
}

function RecordingDot({ live }: { live: boolean }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const blink = useSharedValue(1);
  useEffect(() => {
    if (!live || reduce) {
      blink.set(1);
      return;
    }
    blink.set(withRepeat(withSequence(withTiming(0.25, { duration: 500 }), withTiming(1, { duration: 500 })), -1));
  }, [blink, live, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: blink.get() }));
  return <Animated.View style={[styles.dot, { backgroundColor: live ? colors.danger : colors.inkFaint }, style]} testID={live ? 'voice-dot-live' : 'voice-dot-waiting'} />;
}

function Timer({ clock }: { clock: ClockStore }) {
  const { t } = useTranslation('chat');
  const { duration } = useChatFormat();
  const { durationMs, live } = useVoiceClock(clock);
  const tens = Math.floor(durationMs / 10000) * 10000;
  const left = voiceLimitMs - durationMs;
  return (
    <View style={styles.timer}>
      <RecordingDot live={live} />
      <Text variant="headline" style={styles.tabular} accessibilityLiveRegion="polite" accessibilityLabel={t('composer.recordingElapsed', { time: duration(tens) })} testID="voice-timer">
        {duration(durationMs)}
      </Text>
      {durationMs >= voiceWarnMs ? <LimitChip text={t('composer.timeLeft', { time: duration(Math.max(0, left)) })} /> : null}
    </View>
  );
}

function LimitChip({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.warnBand }]} testID="voice-limit-chip">
      <Text variant="label" tone="warnInk">
        {text}
      </Text>
    </View>
  );
}

function HeldRow({ voice }: { voice: VoiceRecorder }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { dx } = voice;
  const hint = useAnimatedStyle(() => ({ opacity: 1 - 0.9 * Math.min(1, Math.abs(dx.get()) / cancelDistance), transform: [{ translateX: dx.get() }] }));
  return (
    <Animated.View style={styles.row} testID="voice-recording">
      <Timer clock={voice.clock} />
      <Animated.View style={[styles.slide, hint]}>
        <Icon name="chevronLeft" size={18} color={colors.inkSoft} />
        <Text variant="callout" tone="inkSoft" numberOfLines={1}>
          {t('composer.slideToCancel')}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function LiveWave({ clock }: { clock: ClockStore }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  useVoiceClock(clock);
  const count = Math.max(0, Math.floor(width / barPitch));
  const shown = clock.levels.slice(-count);
  const offset = width - shown.length * barPitch;
  const d = shown.map((level, index) => bar(offset + index * barPitch + barWidth / 2, level)).join('');
  return (
    <View style={styles.wave} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} importantForAccessibility="no-hide-descendants" testID="voice-live-wave">
      {width > 0 ? (
        <Svg width={width} height={barMax}>
          <Path d={d} stroke={colors.inkSoft} strokeWidth={barWidth} strokeLinecap="round" />
        </Svg>
      ) : null}
    </View>
  );
}

function bar(x: number, level: number): string {
  const height = barMin + (barMax - barMin) * Math.min(1, Math.max(0, level)) - barWidth;
  const top = (barMax - Math.max(0, height)) / 2;
  return `M${x.toFixed(1)} ${top.toFixed(1)}V${(top + Math.max(0, height)).toFixed(1)}`;
}

function LockedRow({ voice }: { voice: VoiceRecorder }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  return (
    <Animated.View style={styles.row} testID="voice-recording-locked">
      <RoundAction icon="trash" label={t('composer.discardVoice')} color={colors.dangerInk} onPress={voice.discard} testID="voice-discard" />
      <Timer clock={voice.clock} />
      <LiveWave clock={voice.clock} />
      <RoundAction icon="pause" label={t('composer.pauseVoice')} color={colors.inkSoft} onPress={voice.pause} testID="voice-pause" />
    </Animated.View>
  );
}

function PausedRow({ voice, channelId }: { voice: VoiceRecorder; channelId: number }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  return (
    <Animated.View style={styles.row} testID="voice-paused">
      <RoundAction icon="trash" label={t('composer.discardVoice')} color={colors.dangerInk} onPress={voice.discard} testID="voice-discard" />
      <DraftBox voice={voice} channelId={channelId} />
      <RoundAction icon="micResume" label={t('composer.resumeVoice')} color={colors.dangerInk} onPress={voice.resume} testID="voice-resume" />
    </Animated.View>
  );
}

function DraftBox({ voice, channelId }: { voice: VoiceRecorder; channelId: number }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { duration } = useChatFormat();
  const player = useVoice();
  const { durationMs } = useVoiceClock(voice.clock);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const id = `draft-${channelId}`;
  const mine = player.id === id;
  const total = mine && player.duration > 0 ? player.duration : durationMs;
  const position = dragging ?? (mine ? player.position : 0);
  const uri = voice.draftUri;
  const count = Math.max(0, Math.floor(width / barPitch));
  const levels = bucketsOf(voice.clock.levels, count);
  const played = total > 0 ? Math.round((position / total) * levels.length) : 0;
  const path = (from: number, to: number) => levels.slice(from, to).map((level, index) => bar((from + index) * barPitch + barWidth / 2, level)).join('');
  const seekTo = (ms: number) => {
    if (!uri) return;
    void seekVoice(id, uri, Math.min(total, Math.max(0, ms)));
  };
  const fromX = (x: number) => (width > 0 ? (Math.min(width, Math.max(0, x)) / width) * total : 0);
  return (
    <View style={[styles.draft, { backgroundColor: colors.surface2 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mine && player.playing ? t('composer.pauseDraft') : t('composer.playDraft')}
        onPress={() => uri && void toggleVoice(id, uri)}
        hitSlop={reach(draftPlaySize, draftPlaySize)}
        style={[styles.play, { backgroundColor: colors.primary }]}
        testID="voice-draft-play">
        <Icon name={mine && player.playing ? 'pause' : 'play'} size={20} color={colors.onPrimary} />
      </Pressable>
      <View
        style={styles.wave}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('composer.draftSeek')}
        accessibilityValue={{ text: t('composer.draftPosition', { position: duration(position), duration: duration(total) }) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => seekTo(position + (event.nativeEvent.actionName === 'increment' ? seekStepMs : -seekStepMs))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => setDragging(fromX(event.nativeEvent.locationX))}
        onResponderMove={(event) => setDragging(fromX(event.nativeEvent.locationX))}
        onResponderRelease={(event) => {
          seekTo(fromX(event.nativeEvent.locationX));
          setDragging(null);
        }}
        onResponderTerminate={() => setDragging(null)}
        testID="voice-draft-wave">
        {width > 0 ? (
          <Svg width={width} height={barMax}>
            <Path d={path(0, played)} stroke={colors.primary} strokeWidth={barWidth} strokeLinecap="round" />
            <Path d={path(played, levels.length)} stroke={colors.lineStrong} strokeWidth={barWidth} strokeLinecap="round" />
          </Svg>
        ) : null}
      </View>
      <Text variant="footnote" tone="inkSoft" style={styles.tabular} testID="voice-draft-time">
        {t('composer.draftPosition', { position: duration(position), duration: duration(total) })}
      </Text>
    </View>
  );
}

export function InterruptionBanner({ reason }: { reason: Interruption | null }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  if (!reason) return null;
  return (
    <View style={[styles.banner, { backgroundColor: colors.warnBand }]} accessibilityLiveRegion="polite" testID={`voice-interrupted-${reason}`}>
      <Icon name="alert" size={16} color={colors.warnInk} />
      <Text variant="footnote" tone="warnInk" style={styles.flex}>
        {t(`composer.interrupted.${reason}`)}
      </Text>
    </View>
  );
}

export function DiscardAnimation({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const rise = useSharedValue(reduce ? 1 : 0);
  const fly = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      onDone();
      return;
    }
    rise.set(withSequence(withTiming(1, { duration: 160, easing: easing.expo }), withDelay(360, withTiming(0, { duration: 160, easing: easing.exit }))));
    fly.set(withDelay(120, withTiming(1, { duration: 280, easing: Easing.bezier(0.3, 0, 0.2, 1) })));
    const timer = setTimeout(onDone, 680);
    return () => clearTimeout(timer);
  }, [fly, onDone, reduce, rise]);
  const trash = useAnimatedStyle(() => ({ opacity: rise.get(), transform: [{ translateY: interpolate(rise.get(), [0, 1], [24, 0]) }] }));
  const lid = useAnimatedStyle(() => {
    const angle = interpolate(fly.get(), [0, 0.15, 0.85, 1], [0, -38, -38, 0]);
    const hingeX = (trashLidHinge.x - 12) * (trashIcon / 24);
    const hingeY = (trashLidHinge.y - 12) * (trashIcon / 24);
    return { transform: [{ translateX: hingeX }, { translateY: hingeY }, { rotate: `${angle}deg` }, { translateX: -hingeX }, { translateY: -hingeY }] };
  });
  const dot = useAnimatedStyle(() => {
    const progress = fly.get();
    return {
      opacity: progress < 1 ? 1 : 0,
      transform: [{ translateX: interpolate(progress, [0, 1], [56, 0]) }, { translateY: -Math.sin(progress * Math.PI) * 28 }, { scale: interpolate(progress, [0, 1], [1, 0.5]) }],
    };
  });
  return (
    <View pointerEvents="none" style={styles.discard} testID="voice-discard-animation">
      <Animated.View style={[styles.trash, trash]}>
        <Icon name="trashBody" size={trashIcon} color={colors.dangerInk} />
        <Animated.View style={[StyleSheet.absoluteFill, lid]}>
          <Icon name="trashLid" size={trashIcon} color={colors.dangerInk} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.flyingDot, { backgroundColor: colors.danger }, dot]} />
    </View>
  );
}

export const voiceMotion = motion;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: buttonSize, gap: space.xs },
  action: { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2, alignItems: 'center', justifyContent: 'center' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.sm },
  tabular: { fontVariant: ['tabular-nums'] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  slide: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  wave: { flex: 1, height: barMax, justifyContent: 'center' },
  draft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: buttonSize, borderRadius: buttonSize / 2, paddingLeft: 4, paddingRight: space.md },
  play: { width: draftPlaySize, height: draftPlaySize, borderRadius: draftPlaySize / 2, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  trash: { width: trashIcon, height: trashIcon },
  discard: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 120, justifyContent: 'center', paddingLeft: space.sm },
  flyingDot: { position: 'absolute', left: space.sm + 7, width: 10, height: 10, borderRadius: 5 },
});
