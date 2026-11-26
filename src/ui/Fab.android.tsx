import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../layout/tabBar';
import { space, useTheme } from '../theme';
import { Icon, type IconName } from './icons';
import { Pressable } from './Pressable';

export function Fab({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { material } = useTheme();
  const bottom = space.lg + Math.max(useTabBarSpace(), useSafeAreaInsets().bottom);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: `${material.onPrimary}1A`, foreground: true }}
      style={[styles.fab, { bottom, backgroundColor: material.primary }]}
      testID={testID}>
      <Icon name={icon} color={material.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: space.lg, width: 56, height: 56, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
