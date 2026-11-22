import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../../theme';
import { Icon, type IconName } from '../../ui/icons';
import { Text } from '../../ui/Text';

export type MoreAction = { key: string; icon: IconName; label: string; detail?: string; onPress: () => void; tone?: 'danger' };

export type MoreGroup = { key: string; title?: string; actions: MoreAction[] };

export function MoreSheet({
  title,
  groups,
  onClose,
  footer,
  testID = 'mom-more-sheet',
}: {
  title: string;
  groups: MoreGroup[];
  onClose: () => void;
  footer?: ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const shown = groups.filter((group) => group.actions.length);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('mom.menu.close')}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]}
          onPress={() => undefined}
          accessibilityViewIsModal
          testID={testID}>
          <Text variant="headline" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {shown.map((group) => (
              <View key={group.key} style={styles.group}>
                {group.title ? (
                  <Text variant="footnote" tone="inkSoft" accessibilityRole="header" style={styles.groupTitle}>
                    {group.title}
                  </Text>
                ) : null}
                {group.actions.map((action) => (
                  <Pressable
                    key={action.key}
                    accessibilityRole="button"
                    accessibilityLabel={action.detail ? `${action.label}, ${action.detail}` : action.label}
                    onPress={() => {
                      onClose();
                      action.onPress();
                    }}
                    style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface2 }]}
                    testID={`mom-more-${action.key}`}>
                    <Icon name={action.icon} color={action.tone === 'danger' ? colors.dangerInk : colors.ink} />
                    <View style={styles.flex}>
                      <Text variant="body" tone={action.tone === 'danger' ? 'dangerInk' : 'ink'}>
                        {action.label}
                      </Text>
                      {action.detail ? (
                        <Text variant="footnote" tone="inkSoft" numberOfLines={2}>
                          {action.detail}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
            {footer}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '85%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg },
  title: { paddingHorizontal: space.sm, paddingBottom: space.sm },
  body: { gap: space.md, paddingBottom: space.sm },
  group: { gap: space.xs },
  groupTitle: { paddingHorizontal: space.sm, paddingTop: space.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.md },
});
