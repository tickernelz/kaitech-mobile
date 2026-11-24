import { StyleSheet } from 'react-native';
import { Pressable } from './Pressable';
import { space, useTheme } from '../theme';
import { Icon, type IconName } from './icons';

export function Fab({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      testID={testID}>
      <Icon name={icon} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: space.lg, bottom: space.lg, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 3 },
});
