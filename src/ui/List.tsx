import type { ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Pressable } from './Pressable';
import { radius, space, useTheme } from '../theme';
import type { RowBind } from './RowActions';
import { Text } from './Text';

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <Text variant="label" tone="inkSoft" accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>{children}</View>
    </View>
  );
}

export function Row({
  title,
  detail,
  leading,
  trailing,
  onPress,
  tone = 'ink',
  testID,
  selected,
  bind,
}: {
  bind?: RowBind;
  title: string;
  detail?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  tone?: 'ink' | 'dangerInk' | 'link';
  testID?: string;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {leading}
      <View style={styles.rowText}>
        <Text tone={tone}>{title}</Text>
        {detail ? (
          <Text variant="footnote" tone="inkSoft">
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      {...bind}
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      android_ripple={{ color: colors.select }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: colors.surface2 } : bind && { backgroundColor: colors.canvas }]}>
      {content}
    </Pressable>
  );
}

export function Check({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.radio, { borderColor: visible ? colors.primary : colors.edge }]}
      importantForAccessibility="no-hide-descendants">
      {visible ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
    </View>
  );
}

export function ToggleRow({
  title,
  detail,
  value,
  onChange,
  disabled,
  testID,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Row
      title={title}
      detail={detail}
      testID={testID}
      trailing={
        <Switch
          accessibilityLabel={title}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: colors.primary, false: colors.lineStrong }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.lineStrong}
        />
      }
    />
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.line }]} />;
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionTitle: { paddingHorizontal: space.lg },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: 52, paddingHorizontal: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, gap: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
