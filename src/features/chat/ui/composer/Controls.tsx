import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { space, useTheme } from '../../../../theme';
import { duration, easing } from '../../../../theme/motion';
import { Icon, type IconName } from '../../../../ui/icons';
import { Pressable } from '../../../../ui/Pressable';
import type { useVoiceHold } from '../useVoiceHold';
import { lockDistance, type SendMode } from './gesture';

export const buttonSize = 44;
export const controlGap = space.xs;

function useToward(target: number, ms: number = duration.base) {
  const reduce = useReducedMotion();
  const value = useSharedValue(target);
  useEffect(() => {
    value.set(reduce ? target : withTiming(target, { duration: ms, easing: easing.standard }));
  }, [ms, reduce, target, value]);
  return value;
}

export function SendMicButton({ mode, voice, onSend }: { mode: SendMode; voice: ReturnType<typeof useVoiceHold>; onSend: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const recording = voice.recording !== null && !voice.recording.locked;
  const sending = useToward(mode === 'mic' ? 0 : 1, duration.quick);
  const holding = useToward(recording ? 1 : 0, duration.quick);
  const micStyle = useAnimatedStyle(() => ({
    opacity: 1 - sending.get(),
    transform: [{ scale: interpolate(sending.get(), [0, 1], [1, 0.5]) * interpolate(holding.get(), [0, 1], [1, 1.45]) }],
  }));
  const sendStyle = useAnimatedStyle(() => ({
    opacity: sending.get(),
    transform: [{ scale: interpolate(sending.get(), [0, 1], [0.5, 1]) }, { rotate: `${interpolate(sending.get(), [0, 1], [-45, 0])}deg` }],
  }));
  const micActive = mode === 'mic';
  return (
    <View style={styles.slot} testID="composer-send-slot">
      <Animated.View
        accessible={micActive}
        accessibilityRole="button"
        accessibilityLabel={t('composer.recordVoice')}
        accessibilityHint={t('composer.holdToRecord')}
        accessibilityActions={micActive ? [{ name: 'activate' }] : undefined}
        onAccessibilityAction={micActive ? () => voice.startLocked() : undefined}
        importantForAccessibility={micActive ? 'auto' : 'no-hide-descendants'}
        pointerEvents={micActive ? 'auto' : 'none'}
        testID="composer-mic"
        style={[styles.layer, { backgroundColor: recording ? colors.danger : colors.primary }, micStyle]}
        {...(micActive ? voice.hold : {})}>
        <Icon name="mic" color={recording ? colors.surface : colors.onPrimary} />
      </Animated.View>
      <Animated.View style={[styles.layer, sendStyle]} pointerEvents={micActive ? 'none' : 'auto'} importantForAccessibility={micActive ? 'no-hide-descendants' : 'auto'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'voice' ? t('composer.sendVoice') : t('composer.send')}
          onPress={mode === 'voice' ? () => voice.stop(false) : onSend}
          style={[styles.round, { backgroundColor: colors.primary }]}
          testID={mode === 'voice' ? 'composer-send-voice' : 'composer-send'}>
          <Icon name="send" color={colors.onPrimary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function CameraSlot({ shown, onPress }: { shown: boolean; onPress: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const open = useToward(shown ? 1 : 0, duration.quick);
  const slot = useAnimatedStyle(() => ({
    width: open.get() * buttonSize,
    marginLeft: (open.get() - 1) * controlGap,
    opacity: open.get(),
    transform: [{ scale: interpolate(open.get(), [0, 1], [0.6, 1]) }],
  }));
  return (
    <Animated.View style={[styles.cameraSlot, slot]} pointerEvents={shown ? 'auto' : 'none'} importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('composer.camera')} onPress={onPress} style={styles.round} testID="composer-camera">
        <Icon name="photo" color={colors.inkSoft} />
      </Pressable>
    </Animated.View>
  );
}

export function FieldButton({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={2} style={styles.fieldButton} testID={testID}>
      <Icon name={icon} color={colors.inkSoft} />
    </Pressable>
  );
}

export function LockHint({ voice }: { voice: ReturnType<typeof useVoiceHold> }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const recording = voice.recording;
  const shown = recording !== null && !recording.locked;
  const open = useToward(shown ? 1 : 0, duration.quick);
  const lift = recording?.lift ?? 0;
  const style = useAnimatedStyle(() => ({ opacity: open.get(), transform: [{ translateY: interpolate(open.get(), [0, 1], [24, 0]) + Math.max(lift, -lockDistance) / 2 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.lockHint, { backgroundColor: colors.surface, borderColor: colors.line }, style]} accessibilityElementsHidden={!shown} testID={shown ? 'voice-lock-hint' : undefined}>
      <Icon name="lock" size={20} color={colors.inkSoft} />
      <Icon name="chevronUp" size={16} color={colors.inkFaint} />
      <View accessible accessibilityLabel={t('composer.slideToLock')} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: { width: buttonSize, height: buttonSize },
  layer: { ...StyleSheet.absoluteFill, borderRadius: buttonSize / 2, alignItems: 'center', justifyContent: 'center' },
  round: { width: buttonSize, height: buttonSize, borderRadius: buttonSize / 2, alignItems: 'center', justifyContent: 'center' },
  cameraSlot: { height: buttonSize, overflow: 'hidden', alignItems: 'flex-start' },
  fieldButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  lockHint: { position: 'absolute', right: 0, bottom: buttonSize + space.lg, width: buttonSize, paddingVertical: space.sm, borderRadius: buttonSize / 2, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 2 },
});
