import { Pressable, StyleSheet } from 'react-native';
import { radius, useTheme } from '../theme';
import { Icon, type IconName } from './icons';

export function IconButton({
  icon,
  label,
  onPress,
  testID,
  filled = false,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
  filled?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: filled ? colors.primary : pressed ? colors.surface2 : 'transparent', opacity: disabled ? 0.4 : 1 },
      ]}>
      <Icon name={icon} color={filled ? colors.onPrimary : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
