import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, useWindowDimensions } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration, easing, spring } from '../theme/motion';
import { useReduceMotion } from '../theme/reduceMotion';
import { pillBottom, pillCover, pillWidth } from './tabBar';
import { tabSpoken, tabs, type TabName } from './tabs';
import { useTab } from './useTab';
import { useTabCounts } from './useTabCounts';

export type PillTab = { name: TabName; index: number; focused: boolean; label: string; spoken: string; count: number; press: () => void; pressIn: () => void; pressOut: () => void };

export type PillBarState = {
  items: PillTab[];
  selected: number;
  position: SharedValue<number>;
  pressed: SharedValue<number>;
  pressScale: SharedValue<number>;
  hidden: SharedValue<number>;
  keyboard: boolean;
  width: number;
  bottom: number;
  cover: number;
  sideInsets: { left: number; right: number };
  reduceMotion: boolean;
};

function tick() {
  const done = Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key) : Haptics.selectionAsync();
  void done.catch(() => undefined);
}

export function usePillBar(): PillBarState {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const keyboard = useKeyboardState((state) => state.isVisible);
  const counts = useTabCounts();
  const byName: Record<TabName, ReturnType<typeof useTab>> = { chat: useTab('chat'), discovery: useTab('discovery'), mom: useTab('mom'), activity: useTab('activity') };
  const selected = tabs.findIndex((name) => byName[name].focused);
  const position = useSharedValue(selected);
  const pressed = useSharedValue(-1);
  const pressScale = useSharedValue(0);
  const hidden = useSharedValue(keyboard ? 1 : 0);
  useEffect(() => {
    position.set(reduceMotion ? selected : withSpring(selected, spring.spatial));
  }, [selected, reduceMotion, position]);
  useEffect(() => {
    const target = keyboard ? 1 : 0;
    hidden.set(reduceMotion ? target : withTiming(target, { duration: keyboard ? duration.quick : duration.base, easing: keyboard ? easing.exit : easing.standard }));
  }, [keyboard, reduceMotion, hidden]);
  const items = tabs.map((name, index): PillTab => {
    const count = counts[name];
    return {
      name,
      index,
      focused: byName[name].focused,
      label: t(`tabs.${name}`),
      spoken: tabSpoken(t, name, count),
      count,
      press: () => {
        if (byName[name].open()) tick();
      },
      pressIn: () => {
        if (reduceMotion) return;
        pressed.set(index);
        pressScale.set(withSpring(1, spring.effectsFast));
      },
      pressOut: () => {
        if (reduceMotion) return;
        pressScale.set(withSpring(0, spring.effects));
      },
    };
  });
  return {
    items,
    selected,
    position,
    pressed,
    pressScale,
    hidden,
    keyboard,
    width: pillWidth(window.width, insets.left + insets.right),
    bottom: pillBottom(insets.bottom),
    cover: pillCover(insets.bottom),
    sideInsets: { left: insets.left, right: insets.right },
    reduceMotion,
  };
}
