import { useEffect, useRef } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from '../theme/motion';
import { Text } from '../ui/Text';
import type { TabName } from './tabs';

export function PillBadge({ name, text, fill, ink, edge, reduceMotion, style }: { name: TabName; text: string | undefined; fill: string; ink: string; edge?: string; reduceMotion: boolean; style?: ViewStyle }) {
  const scale = useSharedValue(1);
  const shown = useRef(text);
  useEffect(() => {
    const before = shown.current;
    shown.current = text;
    if (!text || text === before || reduceMotion) return;
    scale.set(before ? 1.25 : 0.4);
    scale.set(withSpring(1, spring.spatialFast));
  }, [text, reduceMotion, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  if (!text) return null;
  return (
    <Animated.View style={[styles.badge, { backgroundColor: fill }, edge ? { borderColor: edge, borderWidth: 2 } : null, style, pop]} testID={`tab-badge-${name}`}>
      <Text variant="label" maxFontSizeMultiplier={1.2} style={[styles.text, { color: ink }]}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 10, lineHeight: 12 },
});
