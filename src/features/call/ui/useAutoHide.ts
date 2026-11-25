import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../../../theme/reduceMotion';

export const hideAfterMs = 5000;
const showMs = 200;
const hideMs = 150;
const slide = 16;
const decelerate = Easing.bezier(0.05, 0.7, 0.1, 1);
const accelerate = Easing.bezier(0.3, 0, 0.8, 0.15);

export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (live) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}

export function useAutoHide(pinned: boolean, wakeKey: string) {
  const reduceMotion = useReduceMotion();
  const screenReader = useScreenReader();
  const hold = pinned || screenReader;
  const [visible, setVisible] = useState(true);
  const [touches, setTouches] = useState(0);
  const [timeout, setTimeoutMs] = useState(hideAfterMs);

  useEffect(() => {
    void AccessibilityInfo.getRecommendedTimeoutMillis(hideAfterMs).then(setTimeoutMs);
  }, []);

  const wake = `${hold}|${wakeKey}`;
  const [seenWake, setSeenWake] = useState(wake);
  if (seenWake !== wake) {
    setSeenWake(wake);
    setVisible(true);
  }

  useEffect(() => {
    if (hold || !visible) return;
    const timer = setTimeout(() => setVisible(false), timeout);
    return () => clearTimeout(timer);
  }, [hold, visible, timeout, touches, wakeKey]);

  const shown = visible || hold;
  const progress = useSharedValue(1);
  useEffect(() => {
    progress.value = withTiming(shown ? 1 : 0, { duration: shown ? showMs : hideMs, easing: shown ? decelerate : accelerate });
  }, [shown, progress]);

  const top = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (progress.value - 1) * slide }],
  }));
  const bottom = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * slide }],
  }));

  const toggle = useCallback(() => {
    if (!hold) setVisible((current) => !current);
  }, [hold]);
  const poke = useCallback(() => {
    setVisible(true);
    setTouches((count) => count + 1);
  }, []);

  return { shown, toggle, poke, top, bottom, screenReader };
}
