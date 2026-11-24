import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { radius, space, useTheme } from '../theme';
import { duration, easing } from '../theme/motion';
import { useSurface } from './glass';
import { Text } from './Text';

const liquidGlass = isLiquidGlassAvailable();

export const largeTitleOwnsActions = !liquidGlass;

const largeTitleHeight = 48;

export function useCollapsingTitle(): { collapsed: boolean; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const [collapsed, setCollapsed] = useState(false);
  return { collapsed, onScroll: (event) => setCollapsed(event.nativeEvent.contentOffset.y > largeTitleHeight) };
}

export function TopAppBar(props: { title: string; collapsed: boolean; navigation?: ReactNode; actions?: ReactNode }) {
  return liquidGlass ? <GlassAppBar {...props} /> : null;
}

function GlassAppBar({ title, collapsed, navigation, actions }: { title: string; collapsed: boolean; navigation?: ReactNode; actions?: ReactNode }) {
  const { colors } = useTheme();
  const glass = useSurface() === 'glass';
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(collapsed ? 1 : 0);
  useEffect(() => {
    const target = collapsed ? 1 : 0;
    shown.set(reduceMotion ? target : withTiming(target, { duration: duration.base, easing: easing.standard }));
  }, [collapsed, reduceMotion, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }));
  const edge = !glass && collapsed ? { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth } : null;
  return (
    <View style={[styles.bar, { backgroundColor: colors.canvas }, edge]} testID="app-bar">
      <View style={styles.side}>{navigation}</View>
      <Animated.View style={[styles.title, fade]} importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'} accessibilityElementsHidden={!collapsed} testID="app-bar-title">
        <Text variant="headline" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>
      <View style={[styles.side, styles.end]}>
        {actions && glass ? (
          <GlassView isInteractive style={styles.group} testID="app-bar-actions">
            {actions}
          </GlassView>
        ) : (
          actions
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  end: { justifyContent: 'flex-end' },
  title: { flexShrink: 1, alignItems: 'center', paddingHorizontal: space.sm },
  group: { borderRadius: radius.pill, padding: 2 },
});
