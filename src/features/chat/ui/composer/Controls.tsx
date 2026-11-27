import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { radius, space, useTheme } from '../../../../theme';
import { duration, easing, spring } from '../../../../theme/motion';
import { Icon, type IconName } from '../../../../ui/icons';
import { lockShackleDrop } from '../../../../ui/icons/glyphs';
import { Pressable } from '../../../../ui/Pressable';
import { Text } from '../../../../ui/Text';
import { keepEdgeGestures } from '../../voice/edgeGestures';
import { isHeld } from '../../voice/machine';
import { lockDistance, type SendMode } from './gesture';
import type { VoiceRecorder } from './useVoiceRecorder';
import { pill } from '../../../../ui/pill';
import { reach, touchTarget } from '../../../../ui/touch';

export const buttonSize = pill.composer.button;
export const insideSize = pill.composer.inside;
export const heldSize = 72;
export const controlGap = pill.composer.gap;
const fieldButtonHeight = insideSize;
const fieldButtonSlop = reach(fieldButtonHeight);
const lockIcon = 20;

export function useToward(target: number, ms: number = duration.base, curve = easing.standard) {
  const reduce = useReducedMotion();
  const value = useSharedValue(target);
  useEffect(() => {
    value.set(reduce ? target : withTiming(target, { duration: ms, easing: curve }));
  }, [curve, ms, reduce, target, value]);
  return value;
}

export function SendMicButton({ mode, voice, tapMode, onSend }: { mode: SendMode; voice: VoiceRecorder; tapMode: boolean; onSend: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const held = isHeld(voice.state);
  const sending = useToward(mode === 'mic' ? 0 : 1, duration.quick);
  const grow = useSharedValue(0);
  useEffect(() => {
    if (!held) grow.set(reduce ? 0 : withTiming(0, { duration: duration.quick, easing: easing.standard }));
    else grow.set(reduce ? 1 : withSequence(withTiming(1.12, { duration: 150, easing: easing.expo }), withTiming(1, { duration: 70, easing: easing.standard })));
  }, [grow, held, reduce]);
  const big = heldSize / buttonSize;
  const { dx, dy, level } = voice;
  const micStyle = useAnimatedStyle(() => ({
    opacity: 1 - sending.get(),
    transform: [
      { translateX: grow.get() > 0 ? dx.get() : 0 },
      { translateY: grow.get() > 0 ? dy.get() : 0 },
      { scale: interpolate(sending.get(), [0, 1], [1, 0.5]) * interpolate(grow.get(), [0, 1], [1, big]) },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: grow.get() > 0 ? 0.18 : 0,
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }, { scale: (1 + 0.35 * level.get()) * interpolate(grow.get(), [0, 1], [1, big]) }],
  }));
  const sendStyle = useAnimatedStyle(() => ({
    opacity: sending.get(),
    transform: reduce ? [] : [{ scale: interpolate(sending.get(), [0, 1], [0.5, 1]) }, { rotate: `${interpolate(sending.get(), [0, 1], [-45, 0])}deg` }],
  }));
  const micActive = mode === 'mic';
  return (
    <View onLayout={keepEdgeGestures} collapsable={false} style={styles.slot} testID="composer-send-slot">
      <Animated.View pointerEvents="none" style={[styles.layer, { backgroundColor: colors.primary }, ringStyle]} />
      <Animated.View
        accessible={micActive}
        accessibilityRole="button"
        accessibilityLabel={t('composer.recordVoice')}
        accessibilityHint={t('composer.recordHint')}
        accessibilityActions={micActive ? [{ name: 'activate', label: t('composer.recordVoice') }] : undefined}
        onAccessibilityAction={micActive ? () => voice.startLocked() : undefined}
        importantForAccessibility={micActive ? 'auto' : 'no-hide-descendants'}
        pointerEvents={micActive ? 'auto' : 'none'}
        testID={tapMode ? 'composer-mic-tap' : 'composer-mic'}
        style={[styles.layer, { backgroundColor: colors.primary }, micStyle]}
        {...(micActive ? voice.hold : {})}>
        <Icon name="mic" color={colors.onPrimary} />
      </Animated.View>
      <Animated.View style={[styles.layer, sendStyle]} pointerEvents={micActive ? 'none' : 'auto'} importantForAccessibility={micActive ? 'no-hide-descendants' : 'auto'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'voice' ? t('composer.sendVoice') : t('composer.send')}
          onPress={mode === 'voice' ? voice.send : onSend}
          style={[styles.round, { backgroundColor: colors.primary }]}
          testID={mode === 'voice' ? 'composer-send-voice' : 'composer-send'}>
          <Icon name="send" color={colors.onPrimary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function CameraSlot({ shown, onPress, onLongPress }: { shown: boolean; onPress: () => void; onLongPress?: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const open = useToward(shown ? 1 : 0, reduce ? 0 : duration.base);
  const fade = useToward(shown ? 1 : 0, duration.quick);
  const slot = useAnimatedStyle(() => ({
    width: open.get() * insideSize,
    marginLeft: (open.get() - 1) * controlGap,
    opacity: fade.get(),
    transform: reduce ? [] : [{ scale: interpolate(open.get(), [0, 1], [0.6, 1]) }],
  }));
  return (
    <Animated.View style={[styles.cameraSlot, slot]} pointerEvents={shown ? 'auto' : 'none'} importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('composer.camera')} accessibilityHint={t('composer.cameraHint')} onPress={onPress} onLongPress={onLongPress} delayLongPress={420} style={styles.inside} testID="composer-camera">
        <Icon name="camera" color={colors.inkSoft} />
      </Pressable>
    </Animated.View>
  );
}

export function FieldButton({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={fieldButtonSlop} style={styles.fieldButton} testID={testID}>
      <Icon name={icon} color={colors.inkSoft} />
    </Pressable>
  );
}

export function LockPill({ voice }: { voice: VoiceRecorder }) {
  const { t } = useTranslation('chat');
  const { colors, scheme } = useTheme();
  const dark = scheme === 'dark';
  const reduce = useReducedMotion();
  const shown = isHeld(voice.state);
  const open = useSharedValue(0);
  useEffect(() => {
    if (shown) open.set(reduce ? 1 : withSequence(withTiming(0, { duration: 80 }), withTiming(1, { duration: duration.slow, easing: easing.expo })));
    else open.set(reduce ? 0 : withTiming(0, { duration: duration.slow, easing: easing.expo }));
  }, [open, reduce, shown]);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!shown || reduce) {
      pulse.set(0);
      return;
    }
    pulse.set(withRepeat(withSequence(withTiming(-5, { duration: 600, easing: easing.standard }), withTiming(0, { duration: 600, easing: easing.standard })), -1));
  }, [pulse, reduce, shown]);
  const { dy } = voice;
  const pill = useAnimatedStyle(() => ({
    opacity: open.get(),
    transform: [{ translateY: interpolate(open.get(), [0, 1], [24, 0]) + Math.max(dy.get(), -lockDistance) * 0.5 }, { scale: interpolate(open.get(), [0, 1], [0.6, 1]) }],
  }));
  const shackle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(Math.max(dy.get(), -lockDistance), [-lockDistance, 0], [0, -lockShackleDrop * (lockIcon / 24)]) }] }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ translateY: pulse.get() }], opacity: interpolate(Math.max(dy.get(), -lockDistance), [-lockDistance, 0], [0, 1]) }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
      style={[styles.lockPill, { backgroundColor: colors.surface, borderColor: colors.line }, !dark && styles.lift, pill]}
      testID={shown ? 'voice-lock-pill' : undefined}>
      <View style={styles.lockStack}>
        <Icon name="lockOpen" size={lockIcon} color={colors.inkSoft} />
        <Animated.View style={[StyleSheet.absoluteFill, shackle]}>
          <Icon name="lockShackle" size={lockIcon} color={colors.inkSoft} />
        </Animated.View>
      </View>
      <Animated.View style={chevron}>
        <Icon name="chevronUp" size={16} color={colors.inkFaint} />
      </Animated.View>
      <View accessible accessibilityLabel={t('composer.slideToLock')} />
    </Animated.View>
  );
}

export function ShortHint({ shown }: { shown: boolean }) {
  const { t } = useTranslation('chat');
  const { colors, scheme } = useTheme();
  const dark = scheme === 'dark';
  const open = useToward(shown ? 1 : 0, duration.base);
  const style = useAnimatedStyle(() => ({ opacity: open.get(), transform: [{ translateY: interpolate(open.get(), [0, 1], [8, 0]) }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.hint, { backgroundColor: colors.surface, borderColor: colors.line }, !dark && styles.lift, style]} accessibilityLiveRegion="polite">
      {shown ? (
        <Text variant="footnote" testID="voice-short-hint">
          {t('composer.shortHint')}
        </Text>
      ) : null}
    </Animated.View>
  );
}

export const springIn = spring.spatial;

const styles = StyleSheet.create({
  slot: { width: buttonSize, height: buttonSize },
  layer: { ...StyleSheet.absoluteFill, borderRadius: buttonSize / 2, alignItems: 'center', justifyContent: 'center' },
  round: { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2, alignItems: 'center', justifyContent: 'center' },
  inside: { width: insideSize, height: insideSize, borderRadius: insideSize / 2, alignItems: 'center', justifyContent: 'center' },
  cameraSlot: { height: insideSize, overflow: 'hidden', alignItems: 'flex-start' },
  fieldButton: { width: touchTarget, height: fieldButtonHeight, borderRadius: fieldButtonHeight / 2, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  lockPill: { position: 'absolute', right: 0, bottom: buttonSize + 40, width: buttonSize, height: 100, paddingVertical: space.md, borderRadius: buttonSize / 2, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: space.xs },
  lockStack: { width: lockIcon, height: lockIcon },
  lift: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  hint: { position: 'absolute', right: 0, bottom: buttonSize + space.sm, maxWidth: 280, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
