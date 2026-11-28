import { TabList, TabSlot, TabTrigger, Tabs, defaultTabsSlotRender } from 'expo-router/ui';
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { duration, easing } from '../theme/motion';
import { useReduceMotion } from '../theme/reduceMotion';
import { NavRail } from './NavRail';
import { PillBar } from './PillBar';
import { TabBarSpace, pillCover } from './tabBar';
import { allTabs, routes } from './tabs';
import { useClientLanding } from './useClientLanding';
import { useWindowClass } from './windowClass';

type SlotRender = typeof defaultTabsSlotRender;

function TabScene({ focused, started, children }: { focused: boolean; started: RefObject<boolean>; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const shown = useSharedValue(1);
  const before = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    const entering = focused && (before.current === false || (before.current === null && started.current));
    before.current = focused;
    if (!entering || reduceMotion) return;
    shown.set(0);
    shown.set(withTiming(1, { duration: duration.slow, easing: easing.expo }));
  }, [focused, reduceMotion, shown, started]);
  const scene = useAnimatedStyle(() => (shown.get() === 1 ? { opacity: 1, transform: [] } : { opacity: shown.get(), transform: [{ scale: 0.98 + 0.02 * shown.get() }] }));
  return <Animated.View style={[styles.fill, scene]}>{children}</Animated.View>;
}

export function PillTabs() {
  const { material } = useTheme();
  const insets = useSafeAreaInsets();
  const { windowClass } = useWindowClass();
  const rail = windowClass !== 'compact';
  const started = useRef(false);
  useClientLanding();
  useEffect(() => {
    started.current = true;
  }, []);
  const render = useCallback<SlotRender>(
    (descriptor, options) =>
      defaultTabsSlotRender(
        {
          ...descriptor,
          render: () => (
            <TabScene focused={options.isFocused} started={started}>
              {descriptor.render()}
            </TabScene>
          ),
        },
        options,
      ),
    [],
  );
  return (
    <TabBarSpace value={rail ? 0 : pillCover(insets.bottom)}>
      <Tabs style={[styles.fill, styles.row, { backgroundColor: material.background }]}>
        <TabList style={styles.hidden}>
          {allTabs.map((name) => (
            <TabTrigger key={name} name={routes[name].name} href={routes[name].href} />
          ))}
        </TabList>
        {rail ? <NavRail /> : null}
        <TabSlot style={styles.fill} renderFn={render} />
        {rail ? null : <PillBar />}
      </Tabs>
    </TabBarSpace>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  hidden: { display: 'none' },
});
