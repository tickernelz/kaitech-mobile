import { useCallback, useState, type ReactNode } from 'react';
import { GestureDetector, useExclusiveGestures, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const maxScale = 5;
const doubleTapScale = 2.5;
const tapSlop = 10;

export function Zoomable({
  width,
  height,
  children,
  onZoomChange,
  onSingleTap,
  testID,
}: {
  width: number;
  height: number;
  children: ReactNode;
  onZoomChange?: (zoomed: boolean) => void;
  onSingleTap?: () => void;
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);
  const report = useCallback(
    (next: boolean) => {
      setZoomed(next);
      onZoomChange?.(next);
    },
    [onZoomChange],
  );
  const tapped = useCallback(() => onSingleTap?.(), [onSingleTap]);
  const clampOffset = (value: number, factor: number, size: number) => {
    'worklet';
    const limit = (size * (factor - 1)) / 2;
    return Math.min(limit, Math.max(-limit, value));
  };
  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet';
      startScale.value = scale.value;
    },
    onUpdate: (event) => {
      'worklet';
      scale.value = Math.min(maxScale, Math.max(1, startScale.value * event.scale));
      x.value = clampOffset(x.value, scale.value, width);
      y.value = clampOffset(y.value, scale.value, height);
    },
    onDeactivate: () => {
      'worklet';
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        scheduleOnRN(report, false);
      } else {
        scheduleOnRN(report, true);
      }
    },
  });
  const pan = usePanGesture({
    enabled: zoomed,
    onBegin: () => {
      'worklet';
      startX.value = x.value;
      startY.value = y.value;
    },
    onUpdate: (event) => {
      'worklet';
      x.value = clampOffset(startX.value + event.translationX, scale.value, width);
      y.value = clampOffset(startY.value + event.translationY, scale.value, height);
    },
  });
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDistance: tapSlop,
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled) return;
      const next = scale.value > 1 ? 1 : doubleTapScale;
      scale.value = withTiming(next);
      x.value = withTiming(0);
      y.value = withTiming(0);
      scheduleOnRN(report, next > 1);
    },
  });
  const singleTap = useTapGesture({
    numberOfTaps: 1,
    maxDistance: tapSlop,
    requireToFail: doubleTap,
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled) scheduleOnRN(tapped);
    },
  });
  const taps = useExclusiveGestures(doubleTap, singleTap);
  const gesture = useSimultaneousGestures(pinch, pan, taps);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]} testID={testID}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
