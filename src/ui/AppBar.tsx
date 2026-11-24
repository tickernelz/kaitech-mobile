import { useCallback, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { space, useTheme } from '../theme';
import { Text } from './Text';

export const appBarHeight = 64;

export function useScrolledUnder(): { scrolled: boolean; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const [scrolled, setScrolled] = useState(false);
  const shown = useRef(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 0;
    if (next === shown.current) return;
    shown.current = next;
    setScrolled(next);
  }, []);
  return { scrolled, onScroll };
}

export function TopAppBar({ title, scrolled, navigation, actions }: { title: string; scrolled: boolean; navigation?: ReactNode; actions?: ReactNode }) {
  const { material } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: scrolled ? material.surfaceContainer : material.background }]} testID="app-bar">
      {navigation}
      <Text variant="title" accessibilityRole="header" numberOfLines={1} style={[styles.title, !navigation && styles.titleInset, { color: material.onSurface }]} testID="app-bar-title">
        {title}
      </Text>
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: appBarHeight, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  title: { flex: 1 },
  titleInset: { paddingLeft: space.md },
});
