import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { space, useTheme } from '../theme';
import { spring } from '../theme/motion';
import { Text } from './Text';

const expandedTitleHeight = 48;

export function useCollapsingTitle(): { collapsed: boolean; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const [collapsed, setCollapsed] = useState(false);
  return { collapsed, onScroll: (event) => setCollapsed(event.nativeEvent.contentOffset.y > expandedTitleHeight) };
}

export function CollapsedAppBar({ title, collapsed, actions }: { title: string; collapsed: boolean; actions?: ReactNode }) {
  const { material } = useTheme();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(collapsed ? 1 : 0);
  useEffect(() => {
    const target = collapsed ? 1 : 0;
    shown.set(reduceMotion ? target : withSpring(target, spring.effects));
  }, [collapsed, reduceMotion, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <Animated.View
      pointerEvents={collapsed ? 'box-none' : 'none'}
      importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'}
      style={[styles.bar, { backgroundColor: material.surfaceContainer }, fade]}
      testID="app-bar-collapsed">
      <Text variant="title" accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: material.onSurface }]}>
        {title}
      </Text>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg, paddingRight: space.xs },
  title: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
