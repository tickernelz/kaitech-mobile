import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Overlay } from '../../ui/Overlay';
import { Pressable } from '../../ui/Pressable';
import { radius, space, useTheme } from '../../theme';
import { Icon, type IconName } from '../../ui/icons';
import { Text } from '../../ui/Text';
import { useBottomInset } from '../../ui/insets';

export type SheetItem = { key: string; label: string; icon?: IconName; tone?: 'ink' | 'dangerInk'; detail?: string; selected?: boolean; onPress: () => void };

export function Sheet({ title, items, onClose, children, testID }: { title?: string; items?: SheetItem[]; onClose: () => void; children?: ReactNode; testID?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomInset = useBottomInset(space.lg);
  return (
    <Overlay visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('records.close')}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: bottomInset }]}
          onPress={() => undefined}
          accessibilityViewIsModal
          testID={testID}>
          {title ? (
            <Text variant="headline" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : null}
          {children}
          {items?.length ? (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={item.selected === undefined ? undefined : { selected: item.selected }}
                  onPress={item.onPress}
                  style={({ pressed }) => [styles.item, (pressed || item.selected) && { backgroundColor: colors.surface2 }]}
                  testID={`${testID ?? 'sheet'}-${item.key}`}>
                  {item.icon ? <Icon name={item.icon} color={item.tone === 'dangerInk' ? colors.dangerInk : colors.ink} /> : null}
                  <View style={styles.flex}>
                    <Text variant="body" tone={item.tone ?? 'ink'}>
                      {item.label}
                    </Text>
                    {item.detail ? (
                      <Text variant="footnote" tone="inkSoft">
                        {item.detail}
                      </Text>
                    ) : null}
                  </View>
                  {item.selected ? <Icon name="check" color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '85%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg, gap: space.sm },
  title: { paddingHorizontal: space.sm },
  list: { flexGrow: 0 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.sm, paddingVertical: space.sm, borderRadius: radius.md },
});
