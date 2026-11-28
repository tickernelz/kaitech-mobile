import { PixelRatio, StyleSheet, View } from 'react-native';
import { useLargeText, useWindowClass } from '../../../layout/windowClass';
import { radius, space, useTheme } from '../../../theme';
import { Icon, type IconName } from '../../../ui/icons';
import { Pressable } from '../../../ui/Pressable';
import { Text } from '../../../ui/Text';

export type Shortcut = { key: string; icon: IconName; label: string; count?: number; onPress: () => void; testID: string };

export const shortcutHeight = 56;
export const narrowWidth = 360;
const line = PixelRatio.roundToNearestPixel(1);

export function ChatShortcuts({ cells }: { cells: Shortcut[] }) {
  const { colors } = useTheme();
  const { width } = useWindowClass();
  const stacked = useLargeText() || width < narrowWidth;
  if (!cells.length) return null;
  return (
    <View
      style={[styles.surface, stacked ? styles.stacked : null, { backgroundColor: colors.surface, borderColor: colors.line }]}
      testID={stacked ? 'chat-shortcuts-stacked' : 'chat-shortcuts'}>
      {cells.map((cell, index) => (
        <View key={cell.key} style={[styles.slot, stacked ? null : styles.flex]}>
          {index > 0 ? <View style={[stacked ? styles.across : styles.down, { backgroundColor: colors.line }]} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cell.count ? `${cell.label}, ${cell.count}` : cell.label}
            onPress={cell.onPress}
            testID={cell.testID}
            style={({ pressed }) => [styles.cell, { backgroundColor: pressed ? colors.surface2 : colors.surface }]}>
            <Icon name={cell.icon} size={20} color={colors.inkSoft} />
            <Text variant="callout" numberOfLines={stacked ? undefined : 1} style={styles.flex}>
              {cell.label}
            </Text>
            {cell.count ? (
              <Text variant="footnote" tone="inkFaint">
                {cell.count}
              </Text>
            ) : null}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  surface: { flexDirection: 'row', borderRadius: radius.md, borderWidth: line, overflow: 'hidden' },
  stacked: { flexDirection: 'column' },
  slot: { flexDirection: 'row' },
  cell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: shortcutHeight, paddingHorizontal: space.lg },
  down: { width: line, alignSelf: 'stretch' },
  across: { height: line, position: 'absolute', top: 0, left: 0, right: 0 },
});
