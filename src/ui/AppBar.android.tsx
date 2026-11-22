import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { space, useTheme } from '../theme';
import { spring } from '../theme/motion';
import { Text } from './Text';

export const largeTitleOwnsActions = false;

const expandedTitleHeight = 48;

export function useCollapsingTitle(): { collapsed: boolean; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const [collapsed, setCollapsed] = useState(false);
  return { collapsed, onScroll: (event) => setCollapsed(event.nativeEvent.contentOffset.y > expandedTitleHeight) };
}

export function TopAppBar({ title, collapsed, navigation, actions }: { title: string; collapsed: boolean; navigation?: ReactNode; actions?: ReactNode }) {
  const { material } = useTheme();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(collapsed ? 1 : 0);
  useEffect(() => {
    const target = collapsed ? 1 : 0;
    shown.set(reduceMotion ? target : withSpring(target, spring.effects));
  }, [collapsed, reduceMotion, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <View style={[styles.bar, { backgroundColor: collapsed ? material.surfaceContainer : material.background }]} testID="app-bar">
      {navigation}
      <Animated.View style={[styles.title, fade]} importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'} testID="app-bar-title">
        <Text variant="title" accessibilityRole="header" numberOfLines={1} style={{ color: material.onSurface }}>
          {title}
        </Text>
      </Animated.View>
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 64, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  title: { flex: 1, paddingLeft: space.md },
});
