import { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { radius, space, stroke, type as typography, useTheme } from '../theme';
import { Icon } from './icons';
import { touchTarget } from './touch';

const searchHeight = 48;

export function SearchField({
  label,
  style,
  onFocus,
  onBlur,
  ...props
}: Omit<TextInputProps, 'placeholder' | 'placeholderTextColor' | 'accessibilityLabel' | 'style'> & { label: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: focused ? colors.focus : colors.edge, borderWidth: focused ? 2 : stroke.thin }, style]}>
      <Icon name="search" color={colors.inkSoft} />
      <TextInput
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholder={label}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={label}
        disableFullscreenUI
        selectionColor={colors.focus}
        style={[typography.body, styles.input, { color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: searchHeight, borderRadius: radius.pill, paddingHorizontal: space.lg },
  input: { flex: 1, minHeight: touchTarget },
});
