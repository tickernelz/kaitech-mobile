import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Modal } from './Modal';
import { Pressable } from './Pressable';
import { useTranslation } from 'react-i18next';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { NativeSheet, useSheetPresentation } from './NativeSheet';
import { Text } from './Text';
import { Icon, type IconName } from './icons';

export function Sheet({
  title,
  detail,
  onClose,
  children,
  footer,
  scroll = true,
  testID,
}: {
  title?: string;
  detail?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardState((state) => (state.isVisible ? state.height : 0));
  const sheet = useSheetPresentation(onClose);
  const head = title ? (
    <View style={styles.head}>
      <View style={styles.fill}>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" tone="inkSoft">
            {detail}
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('sheet.close')} onPress={() => sheet.close()} hitSlop={8} style={styles.close} testID={testID ? `${testID}-close` : undefined}>
        <Icon name="close" color={colors.inkSoft} />
      </Pressable>
    </View>
  ) : null;
  const body = scroll ? (
    <ScrollView style={styles.grow} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bounces={false}>
      {head}
      {children}
    </ScrollView>
  ) : (
    <View style={styles.body}>
      {head}
      {children}
    </View>
  );
  const foot = footer ? <View style={styles.footer}>{footer}</View> : null;
  if (sheet.native) {
    return (
      <NativeSheet presentation={sheet.presentation} testID={testID}>
        {body}
        {foot}
      </NativeSheet>
    );
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable
        style={[styles.scrim, { backgroundColor: colors.scrim, paddingBottom: keyboard }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('sheet.close')}
        testID={testID ? `${testID}-backdrop` : undefined}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: keyboard ? space.lg : Math.max(insets.bottom, space.lg) }]}
          onPress={() => undefined}
          accessibilityViewIsModal
          testID={testID}>
          {body}
          {foot}
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
  selected,
  testID,
}: {
  icon?: IconName;
  label: string;
  detail?: string;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const ink = danger ? colors.dangerInk : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.item, (pressed || selected) && { backgroundColor: colors.surface2 }, disabled && styles.dim]}
      testID={testID}>
      {icon ? <Icon name={icon} color={ink} /> : null}
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
      {selected ? <Icon name="check" color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 0 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '88%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg },
  body: { paddingHorizontal: space.lg, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingLeft: space.sm, paddingBottom: space.sm },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -space.sm },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.sm, borderRadius: radius.md },
  dim: { opacity: 0.5 },
});
