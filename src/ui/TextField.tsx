import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { radius, space, type as typography, useTheme } from '../theme';
import { Text } from './Text';

export type TextFieldRef = ComponentRef<typeof TextInput>;

export function TextField({
  label,
  hint,
  error,
  style,
  ref,
  onFocus,
  onBlur,
  ...props
}: Omit<TextInputProps, 'ref'> & { label: string; hint?: string; error?: string | null; ref?: Ref<TextFieldRef> }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? colors.danger : focused ? colors.focus : colors.edge;
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="inkSoft">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.inkFaint}
        selectionColor={colors.focus}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          typography.body,
          styles.input,
          { color: colors.ink, backgroundColor: colors.surface, borderColor: border, borderWidth: focused || error ? 2 : 1 },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text
          variant="footnote"
          tone="dangerInk"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          testID={props.testID ? `${props.testID}-error` : undefined}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" tone="inkFaint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  input: { minHeight: 52, borderRadius: radius.field, paddingHorizontal: space.lg },
});
