import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { radius, space, useTheme } from '../../../theme';
import { haptic } from '../../../ui/haptic';
import { Icon } from '../../../ui/icons';
import type { Message } from '../types';

export const replySlop = 16;
export const replyReach = 64;
export const replyMax = 88;
const verticalSlop = 12;
const settleMs = 180;

export function replyPull(translationX: number): number {
  'worklet';
  const pulled = translationX - replySlop;
  if (pulled <= 0) return 0;
  if (pulled <= replyReach) return pulled;
  return Math.min(replyMax, replyReach + (pulled - replyReach) * 0.3);
}

function ReplyHint({ x, testID }: { x: SharedValue<number>; testID: string }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const pulled = x.get();
    return { opacity: interpolate(pulled, [0, replyReach], [0, 1], 'clamp'), transform: [{ translateX: -pulled }, { scale: interpolate(pulled, [0, replyReach], [0.6, 1], 'clamp') }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.hint, style]} testID={testID}>
      <View style={[styles.disc, { backgroundColor: colors.surface2 }]}>
        <Icon name="reply" size={18} color={colors.inkSoft} />
      </View>
    </Animated.View>
  );
}

export function SwipeReply({ message, onReply, children }: { message: Message; onReply: (message: Message) => void; children: ReactNode }) {
  const x = useSharedValue(0);
  const armed = useSharedValue(false);
  const [dragged, setDragged] = useState(false);
  const reply = useCallback(() => onReply(message), [message, onReply]);
  const pan = usePanGesture({
    activeOffsetX: replySlop,
    failOffsetY: [-verticalSlop, verticalSlop],
    testID: `message-${message.id}-swipe`,
    onActivate: () => {
      'worklet';
      scheduleOnRN(setDragged, true);
    },
    onUpdate: (event) => {
      'worklet';
      const next = replyPull(event.translationX);
      x.set(next);
      if (next >= replyReach && !armed.get()) {
        armed.set(true);
        scheduleOnRN(haptic.tick);
      } else if (next < replyReach) {
        armed.set(false);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      const fire = armed.get() && !event.canceled;
      armed.set(false);
      x.set(
        withTiming(0, { duration: settleMs }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(setDragged, false);
        }),
      );
      if (fire) scheduleOnRN(reply);
    },
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>
        {dragged ? <ReplyHint x={x} testID={`message-${message.id}-reply-hint`} /> : null}
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hint: { position: 'absolute', left: space.md, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
  disc: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
