import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { ApiError } from '../../api/odoo';
import { AppError } from '../../auth/errors';
import { radius, space, stroke, useTheme, type Colors } from '../../theme';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/icons';
import { Text } from '../../ui/Text';

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
              { backgroundColor: selected ? colors.select : colors.surface, borderColor: selected ? colors.select : colors.line },
            ]}>
            <Text variant="callout" style={{ color: selected ? colors.selectInk : colors.ink }}>
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
  return (error: unknown) => {
    if (error instanceof ApiError && error.detail?.trim()) return error.detail.trim();
    return t(errorKey(error) as never, { defaultValue: t('errors.unknown') }) as string;
  };
}

export function StateView({
  offline,
  loading,
  error,
  empty,
  onRetry,
  testID,
}: {
  offline?: boolean;
  loading?: boolean;
  error?: unknown;
  empty?: { title: string; body?: string; icon?: IconName };
  onRetry?: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const errorText = useErrorText();
  if (offline) {
    return (
      <View style={styles.state} testID={testID ? `${testID}-offline` : undefined}>
        <Icon name="cloudOff" size={48} color={colors.inkFaint} />
        <Text variant="headline" style={styles.center} accessibilityRole="alert">
          {t('network.offlineTitle')}
        </Text>
        <Text tone="inkSoft" style={styles.center}>
          {t('network.offlineBody')}
        </Text>
      </View>
    );
  }
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
        {empty.icon ? <Icon name={empty.icon} size={48} color={colors.inkFaint} /> : null}
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
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3 },
  segments: { gap: space.sm, paddingVertical: space.xs },
  segment: { minHeight: 44, borderRadius: radius.pill, borderWidth: stroke.thin, paddingHorizontal: space.lg, justifyContent: 'center' },
  card: { borderRadius: radius.card, borderWidth: stroke.thin, padding: space.lg, gap: space.sm },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  center: { textAlign: 'center' },
});
