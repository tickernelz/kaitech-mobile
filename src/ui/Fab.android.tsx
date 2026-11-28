import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../layout/tabBar';
import { space, useTheme } from '../theme';
import { GlassCapsule } from './GlassCapsule';
import { Icon, type IconName } from './icons';
import { glassEdge } from './pill';
import { Pressable } from './Pressable';

const size = 56;

export function Fab({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { material } = useTheme();
  const bottom = space.lg + Math.max(useTabBarSpace(), useSafeAreaInsets().bottom);
  return (
    <GlassCapsule thickness="thick" solid={[styles.raised, { backgroundColor: material.surfaceContainer, borderColor: material.outlineVariant }]} style={[styles.fab, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        android_ripple={{ color: `${material.onSurface}1A`, foreground: true }}
        style={styles.press}
        testID={testID}>
        <Icon name={icon} size={24} color={material.primary} />
      </Pressable>
    </GlassCapsule>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: space.lg, width: size, height: size, borderRadius: size / 2 },
  raised: { borderWidth: glassEdge, elevation: 3 },
  press: { flex: 1, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
