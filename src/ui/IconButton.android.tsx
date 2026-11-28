import type { ComponentRef, Ref } from 'react';
import { StyleSheet, type View } from 'react-native';
import { Pressable } from './Pressable';
import { radius, useTheme } from '../theme';
import { Icon, type IconName } from './icons';

export function IconButton({
  icon,
  label,
  onPress,
  testID,
  filled = false,
  disabled,
  ref,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
  filled?: boolean;
  disabled?: boolean;
  ref?: Ref<ComponentRef<typeof View>>;
}) {
  const { colors, material } = useTheme();
  const ink = filled ? material.onPrimary : colors.ink;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      testID={testID}
      android_ripple={{ color: `${ink}1A`, foreground: true }}
      style={[styles.button, { backgroundColor: filled ? material.primary : 'transparent', opacity: disabled ? 0.38 : 1 }]}>
      <Icon name={icon} color={ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, margin: 2, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
