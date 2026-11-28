import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../layout/tabBar';
import { space, useTheme } from '../theme';
import { GlassCapsule } from './GlassCapsule';
import { glassMaterial } from './glassMaterial';
import { Icon, type IconName } from './icons';
import { glassEdge } from './pill';
import { Pressable } from './Pressable';

const size = 56;

export function Fab({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { colors, scheme } = useTheme();
  const bottom = space.lg + Math.max(useTabBarSpace(), useSafeAreaInsets().bottom);
  return (
    <GlassCapsule
      liquid
      thickness="thick"
      solid={[styles.edge, { backgroundColor: colors.surface, borderColor: colors.line, boxShadow: glassMaterial(scheme, 'thick').shadow }]}
      style={[styles.fab, { bottom }]}
      testID={testID ? `${testID}-glass` : undefined}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.press, { opacity: pressed ? 0.8 : 1 }]} testID={testID}>
        <Icon name={icon} size={24} color={colors.primary} />
      </Pressable>
    </GlassCapsule>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: space.lg, width: size, height: size, borderRadius: size / 2 },
  edge: { borderWidth: glassEdge },
  press: { flex: 1, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
});
