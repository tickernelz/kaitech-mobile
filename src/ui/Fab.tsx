import { StyleSheet } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../layout/tabBar';
import { space, useTheme } from '../theme';
import { Icon, type IconName } from './icons';

export function Fab({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  const bottom = space.lg + Math.max(useTabBarSpace(), useSafeAreaInsets().bottom);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      testID={testID}>
      <Icon name={icon} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: space.lg, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 3 },
});
