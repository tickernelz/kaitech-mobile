import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ApiError } from '../../api/odoo';
import { AppError } from '../../auth/errors';
import { radius, space, useTheme, type Colors } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';

export const icons = {
  back: 'M15.4 4.6 8 12l7.4 7.4-1.4 1.4L5.2 12l8.8-8.8Z',
  chevron: 'm9.4 4.6 7.4 7.4-7.4 7.4L8 18l6-6-6-6Z',
  down: 'm4.6 8.6 7.4 7.4 7.4-7.4L18 7.2l-6 6-6-6Z',
  search: 'M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3-1.4 1.4-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z',
  close: 'm6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4Z',
  sparkle: 'M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9Zm7 12 .9 2.6 2.6.9-2.6.9L19 21.5l-.9-2.6-2.6-.9 2.6-.9Z',
  send: 'M4 4.5 21 12 4 19.5l2.2-7.5Zm3.8 8.5-1.1 3.6L16 12 6.7 7.4 7.8 11H13v2Z',
  history: 'M13 3a9 9 0 1 1-8.5 12h2.1A7 7 0 1 0 6 9.6L8.4 12H3V6.6l1.6 1.6A9 9 0 0 1 13 3Zm-1 4h2v5.4l3.5 2.1-1 1.7L12 13.5Z',
  hand: 'M9 3a1.5 1.5 0 0 1 1.5 1.5V11h1V3.5a1.5 1.5 0 0 1 3 0V11h1V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-12.9 3.8L3.3 13a1.5 1.5 0 0 1 2.5-1.6l1.7 2.3V4.5A1.5 1.5 0 0 1 9 3Z',
  bulb: 'M12 2a7 7 0 0 1 4 12.7V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3A7 7 0 0 1 12 2Zm-3 18h6v2H9Z',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Zm-6 8h2a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.9V20h3v2H8v-2h3v-3.1A6 6 0 0 1 6 11Z',
  doc: 'M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5ZM8 12v2h8v-2Zm0 4v2h6v-2Z',
  meeting: 'M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2Zm-2 7v10h14V9Zm2 2h4v4H7Z',
  chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6A.5.5 0 0 1 5 19.2V16a2.5 2.5 0 0 1-1-2Z',
  steps: 'M4 5h2v2H4Zm4 0h12v2H8Zm-4 6h2v2H4Zm4 0h12v2H8Zm-4 6h2v2H4Zm4 0h12v2H8Z',
} as const;

export type IconName = keyof typeof icons;

export function Icon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d={icons[name]} fill={color} />
    </Svg>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  testID,
  filled = false,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
  filled?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: filled ? colors.primary : pressed ? colors.surface2 : 'transparent', opacity: disabled ? 0.4 : 1 },
      ]}>
      <Icon name={icon} color={filled ? colors.onPrimary : colors.ink} />
    </Pressable>
  );
}

type Tone = 'neutral' | 'select' | 'ok' | 'warn' | 'danger' | 'info';

const chipColors: Record<Tone, [keyof Colors, keyof Colors]> = {
  neutral: ['surface2', 'inkSoft'],
  select: ['select', 'selectInk'],
  ok: ['okBand', 'okInk'],
  warn: ['warnBand', 'warnInk'],
  danger: ['dangerBand', 'dangerInk'],
  info: ['infoBand', 'infoInk'],
};

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const [fill, ink] = chipColors[tone];
  return (
    <View style={[styles.chip, { backgroundColor: colors[fill] }]}>
      <Text variant="label" style={{ color: colors[ink] }}>
        {label}
      </Text>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segments} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={[
              styles.segment,
              { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.line },
            ]}>
            <Text variant="callout" style={{ color: selected ? colors.onPrimary : colors.ink }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Card({ children, style, testID }: { children: ReactNode; style?: object; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}>
      {children}
    </View>
  );
}

export function errorKey(error: unknown): string {
  if (error instanceof AppError) return `errors.${error.code}`;
  if (error instanceof ApiError) return `discovery.errors.${error.code}`;
  return 'errors.unknown';
}

export function useErrorText() {
  const { t } = useTranslation();
  return (error: unknown) => t(errorKey(error) as never, { defaultValue: t('errors.unknown') }) as string;
}

export function StateView({
  loading,
  error,
  empty,
  onRetry,
  testID,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: { title: string; body?: string };
  onRetry?: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  if (loading) {
    return (
      <View style={styles.state} testID={testID ? `${testID}-loading` : undefined}>
        <ActivityIndicator accessibilityLabel={t('discovery.loading')} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.state} testID={testID ? `${testID}-error` : undefined}>
        <Text variant="headline" style={styles.center} accessibilityRole="alert">
          {errorText(error)}
        </Text>
        {onRetry ? <Button kind="secondary" label={t('discovery.retry')} onPress={onRetry} /> : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.state} testID={testID ? `${testID}-empty` : undefined}>
        <Text variant="headline" style={styles.center}>
          {empty.title}
        </Text>
        {empty.body ? (
          <Text tone="inkSoft" style={styles.center}>
            {empty.body}
          </Text>
        ) : null}
      </View>
    );
  }
  return null;
}

export const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3 },
  segments: { gap: space.sm, paddingVertical: space.xs },
  segment: { minHeight: 44, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, justifyContent: 'center' },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.sm },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  center: { textAlign: 'center' },
});
