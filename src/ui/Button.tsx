import { ActivityIndicator, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from './Pressable';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../theme/reduceMotion';
import { radius, space, useTheme } from '../theme';
import { duration, easing } from '../theme/motion';
import { Text } from './Text';

type Kind = 'primary' | 'secondary' | 'plain' | 'danger';

export function Button({
  label,
  kind = 'primary',
  busy = false,
  disabled,
  style,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & { label: string; kind?: Kind; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const inactive = disabled || busy;
  const fill = { primary: colors.primary, secondary: colors.select, plain: 'transparent', danger: colors.dangerBand }[kind];
  const ink = { primary: colors.onPrimary, secondary: colors.selectInk, plain: colors.link, danger: colors.dangerInk }[kind];
  const press = (to: number) => {
    if (!reduceMotion) scale.set(withTiming(to, { duration: duration.quick, easing: easing.standard }));
  };
  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactive, busy }}
        accessibilityLabel={label}
        disabled={inactive}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        style={({ pressed }) => [
          styles.base,
          { backgroundColor: fill, opacity: inactive && !busy ? 0.5 : pressed && reduceMotion ? 0.8 : 1 },
        ]}
        {...props}>
        {busy ? (
          <ActivityIndicator color={ink} />
        ) : (
          <Text variant="headline" style={[styles.label, { color: ink }]}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
