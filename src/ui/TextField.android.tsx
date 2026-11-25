import { useEffect, useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { space, type as typography, useTheme } from '../theme';
import { spring } from '../theme/motion';
import { Text } from './Text';

export type TextFieldRef = ComponentRef<typeof TextInput>;

const height = 56;
const half = typography.body.lineHeight / 2;
const resting = height / 2 - half;
const raisedAt = -half;

export function TextField({
  label,
  hint,
  error,
  style,
  ref,
  onFocus,
  onBlur,
  onChangeText,
  ...props
}: Omit<TextInputProps, 'ref'> & { label: string; hint?: string; error?: string | null; ref?: Ref<TextFieldRef> }) {
  const { colors, material } = useTheme();
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState(!!props.defaultValue);
  const filled = props.value !== undefined ? props.value.length > 0 : typed;
  const raised = focused || filled || !!props.placeholder;
  const lift = useSharedValue(raised ? 1 : 0);
  useEffect(() => {
    lift.set(reduceMotion ? (raised ? 1 : 0) : withSpring(raised ? 1 : 0, spring.effects));
  }, [lift, raised, reduceMotion]);
  const floating = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(lift.get(), [0, 1], [resting, raisedAt]) }, { scale: interpolate(lift.get(), [0, 1], [1, 0.75]) }],
  }));
  const tint = error ? material.error : focused ? material.primary : material.onSurfaceVariant;
  return (
    <View style={styles.wrap}>
      <View style={[styles.field, { borderColor: error || focused ? tint : material.outline, borderWidth: error || focused ? 2 : 1, backgroundColor: colors.surface }]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={colors.inkFaint}
          selectionColor={material.primary}
          cursorColor={material.primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onChangeText={(text) => {
            setTyped(text.length > 0);
            onChangeText?.(text);
          }}
          style={[typography.body, styles.input, { color: material.onSurface }, style]}
          {...props}
        />
        <Animated.View pointerEvents="none" style={[styles.label, { backgroundColor: colors.surface }, floating]}>
          <Text variant="body" importantForAccessibility="no" numberOfLines={1} style={{ color: tint }}>
            {label}
          </Text>
        </Animated.View>
      </View>
      {error ? (
        <Text
          variant="footnote"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[styles.support, { color: material.error }]}
          testID={props.testID ? `${props.testID}-error` : undefined}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" style={[styles.support, { color: material.onSurfaceVariant }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  field: { borderRadius: 4, minHeight: height, justifyContent: 'center' },
  input: { minHeight: height - 4, paddingHorizontal: space.lg - 2, paddingVertical: space.md },
  label: { position: 'absolute', top: 0, left: space.md - 2, paddingHorizontal: space.xs, transformOrigin: 'left center' },
  support: { paddingHorizontal: space.lg },
});
