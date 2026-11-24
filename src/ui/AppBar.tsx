import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { space, useTheme } from '../theme';
import { Text } from './Text';

export const appBarHeight = 64;

export type ScrolledUnder = { get: () => boolean; subscribe: (listener: () => void) => () => void };

function scrolledUnder(): { scrolled: ScrolledUnder; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  let value = false;
  const listeners = new Set<() => void>();
  return {
    scrolled: {
      get: () => value,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    onScroll: (event) => {
      const next = event.nativeEvent.contentOffset.y > 0;
      if (next === value) return;
      value = next;
      listeners.forEach((listener) => listener());
    },
  };
}

export function useScrolledUnder() {
  const [bar] = useState(scrolledUnder);
  return bar;
}

export function TopAppBar({ title, scrolled: under, navigation, actions }: { title: string; scrolled: ScrolledUnder; navigation?: ReactNode; actions?: ReactNode }) {
  const { material } = useTheme();
  const scrolled = useSyncExternalStore(under.subscribe, under.get);
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
