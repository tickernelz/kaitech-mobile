import { ActivityIndicator, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from './Pressable';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { space, useTheme } from '../theme';
import { spring } from '../theme/motion';
import { Text } from './Text';

type Kind = 'primary' | 'secondary' | 'plain' | 'danger';

const height = 56;
const pressedCorner = 12;

export function Button({
  label,
  kind = 'primary',
  busy = false,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & { label: string; kind?: Kind; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors, material } = useTheme();
  const reduceMotion = useReducedMotion();
  const corner = useSharedValue(height / 2);
  const shape = useAnimatedStyle(() => ({ borderRadius: corner.get() }));
  const inactive = disabled || busy;
  const muted = inactive && !busy;
  const fill = { primary: material.primary, secondary: material.secondaryContainer, plain: 'transparent', danger: material.errorContainer }[kind];
  const ink = { primary: material.onPrimary, secondary: material.onSecondaryContainer, plain: colors.link, danger: material.onErrorContainer }[kind];
  const morph = (to: number) => {
    if (!reduceMotion) corner.set(withSpring(to, spring.spatialFast));
  };
  return (
    <Animated.View style={[styles.shape, shape, { backgroundColor: muted && kind !== 'plain' ? `${material.onSurface}1F` : fill }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactive, busy }}
        accessibilityLabel={label}
        disabled={inactive}
        android_ripple={{ color: `${ink}1A`, foreground: true }}
        onPressIn={(event) => {
          morph(pressedCorner);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          morph(height / 2);
          onPressOut?.(event);
        }}
        style={styles.base}
        {...props}>
        {busy ? (
          <ActivityIndicator color={ink} />
        ) : (
          <Text variant="headline" style={[styles.label, { color: muted ? `${material.onSurface}61` : ink }]}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shape: { overflow: 'hidden' },
  base: { minHeight: height, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
});
