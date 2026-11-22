import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { Icon, type IconName } from './icons';
import { IconButton } from './IconButton';
import { NativeSheet, useSheetPresentation } from './NativeSheet';
import { Text } from './Text';

export type SheetAction = {
  key: string;
  icon: IconName;
  label: string;
  short?: string;
  onPress?: () => void;
  tone?: 'danger';
  choices?: SheetAction[];
};

export function ActionSheet({
  title,
  subtitle,
  actions,
  initial,
  onClose,
}: {
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  initial?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<SheetAction | null>(() => actions.find((action) => action.key === initial && action.choices) ?? null);
  const sheet = useSheetPresentation(onClose);
  const shown = page?.choices ?? actions;
  const choose = (action: SheetAction) => {
    if (action.choices) {
      setPage(action);
      return;
    }
    sheet.close(() => {
      action.onPress?.();
      onClose();
    });
  };
  const content = (
    <>
      <View style={styles.head}>
        {page ? <IconButton icon="back" label={t('row.back')} onPress={() => setPage(null)} testID="row-sheet-back" /> : null}
        <View style={styles.flex}>
          <Text variant="headline" accessibilityRole="header" numberOfLines={2}>
            {page ? page.label : title}
          </Text>
          {!page && subtitle ? (
            <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {shown.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => choose(action)}
          style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface2 }]}
          testID={`row-action-${action.key}`}>
          <Icon name={action.icon} color={action.tone === 'danger' ? colors.dangerInk : colors.ink} />
          <Text variant="body" tone={action.tone === 'danger' ? 'dangerInk' : 'ink'} style={styles.flex}>
            {action.label}
          </Text>
          {action.choices ? <Icon name="forward" size={20} color={colors.inkFaint} /> : null}
        </Pressable>
      ))}
    </>
  );
  if (sheet.native) {
    return (
      <NativeSheet presentation={sheet.presentation} testID="row-sheet">
        <View style={styles.native}>{content}</View>
      </NativeSheet>
    );
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={page ? () => setPage(null) : onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('row.close')}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]}
          onPress={() => undefined}
          accessibilityViewIsModal
          testID="row-sheet">
          {content}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg, gap: space.xs },
  native: { paddingHorizontal: space.lg, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm, minHeight: 44 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.sm, borderRadius: radius.md },
});
