import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { Icon, type IconName } from './icons';
import { Text } from './Text';

export function Sheet({
  title,
  onClose,
  children,
  footer,
  scroll = true,
  testID,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('app.close')}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]}
            onPress={() => undefined}
            accessibilityViewIsModal
            testID={testID}>
            {title ? (
              <View style={styles.head}>
                <Text variant="headline" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
                  {title}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('app.close')} onPress={onClose} hitSlop={8} style={styles.close} testID={testID ? `${testID}-close` : undefined}>
                  <Icon name="close" color={colors.inkSoft} />
                </Pressable>
              </View>
            ) : null}
            {scroll ? (
              <ScrollView style={styles.body} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.body, styles.content]}>{children}</View>
            )}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetRow({
  icon,
  label,
  detail,
  onPress,
  danger,
  selected,
  disabled,
  testID,
}: {
  icon?: IconName;
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const ink = danger ? colors.danger : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, (pressed || selected) && { backgroundColor: colors.surface2 }, disabled && styles.disabled]}
      testID={testID}>
      {icon ? <Icon name={icon} color={ink} /> : null}
      <View style={styles.flex}>
        <Text variant="body" style={{ color: ink }} numberOfLines={2}>
          {label}
        </Text>
        {detail ? (
          <Text variant="footnote" tone="inkSoft" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="check" color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '88%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  content: { paddingHorizontal: space.lg, gap: space.xs },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.sm, borderRadius: radius.md },
  disabled: { opacity: 0.5 },
});
