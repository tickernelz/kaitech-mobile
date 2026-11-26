import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

export function SwipeReply({ message, onReply, children }: { message: Message; onReply: (message: Message) => void; children: ReactNode }) {
  const { colors } = useTheme();
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
      x.set(withTiming(0, { duration: settleMs }));
      if (fire) scheduleOnRN(reply);
    },
  });
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, replyReach], [0, 1], 'clamp'), transform: [{ scale: interpolate(x.get(), [0, replyReach], [0.6, 1], 'clamp') }] }));
  return (
    <GestureDetector gesture={pan}>
      <View>
        {dragged ? (
          <Animated.View pointerEvents="none" style={[styles.icon, iconStyle]} testID={`message-${message.id}-reply-hint`}>
            <View style={[styles.disc, { backgroundColor: colors.surface2 }]}>
              <Icon name="reply" size={18} color={colors.inkSoft} />
            </View>
          </Animated.View>
        ) : null}
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', left: space.md, top: 0, bottom: 0, justifyContent: 'center' },
  disc: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
