import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { Text } from './Text';
import { Icon, type IconName } from './icons';

export function Sheet({ title, detail, onClose, children, testID }: { title: string; detail?: string; onClose: () => void; children: ReactNode; testID?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardState((state) => (state.isVisible ? state.height : 0));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim, paddingBottom: keyboard }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('sheet.close')} testID={testID ? `${testID}-backdrop` : undefined}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: keyboard ? space.lg : Math.max(insets.bottom, space.lg) }]} onPress={() => undefined} accessibilityViewIsModal testID={testID}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.head}>
              <Text variant="headline" accessibilityRole="header">
                {title}
              </Text>
              {detail ? (
                <Text variant="footnote" tone="inkSoft">
                  {detail}
                </Text>
              ) : null}
            </View>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetItem({
  icon,
  label,
  detail,
  onPress,
  disabled,
  danger,
  testID,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const ink = danger ? colors.dangerInk : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface2 }, disabled && styles.dim]}
      testID={testID}>
      <Icon name={icon} color={ink} />
      <View style={styles.fill}>
        <Text variant="body" style={{ color: ink }}>
          {label}
        </Text>
        {detail ? (
          <Text variant="footnote" tone="inkSoft">
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '88%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg },
  body: { paddingHorizontal: space.lg, gap: space.xs },
  head: { gap: space.xs, paddingHorizontal: space.sm, paddingBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.sm, borderRadius: radius.md },
  dim: { opacity: 0.5 },
});
