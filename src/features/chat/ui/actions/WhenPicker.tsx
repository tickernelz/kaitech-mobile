import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import { Text } from '../../../../ui/Text';
import { intlLocale } from '../../../../i18n/language';

const dayMs = 86400000;
const days = 14;

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function timesOfDay(stepMinutes = 30, from = 7, to = 22): number[] {
  const out: number[] = [];
  for (let minute = from * 60; minute < to * 60; minute += stepMinutes) out.push(minute);
  return out;
}

function Chip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.focus : colors.line, backgroundColor: selected ? colors.select : 'transparent' }]}
      testID={testID}>
      <Text variant="footnote" tone={selected ? 'selectInk' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function WhenPicker({
  label,
  value,
  onChange,
  withTime = true,
  allowNone = false,
  testID,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  withTime?: boolean;
  allowNone?: boolean;
  testID?: string;
}) {
  const { t, i18n } = useTranslation('chat');
  const locale = intlLocale(i18n.language === 'id' ? 'id' : 'en');
  const [today] = useState(() => startOfDay(Date.now()));
  const dayList = useMemo(() => Array.from({ length: days }, (_, index) => today + index * dayMs), [today]);
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }), [locale]);
  const clock = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);
  const day = value === null ? null : startOfDay(value);
  const minute = value === null ? null : Math.round((value - startOfDay(value)) / 60000);
  const dayLabel = (ms: number) => (ms === today ? t('when.today') : ms === today + dayMs ? t('when.tomorrow') : weekday.format(ms));
  const pickDay = (ms: number) => onChange(ms + (withTime ? (minute ?? 9 * 60) : 12 * 60) * 60000);
  const pickTime = (minutes: number) => onChange((day ?? today) + minutes * 60000);
  return (
    <View style={styles.wrap} testID={testID}>
      <Text variant="label" tone="inkSoft">
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {allowNone ? <Chip label={t('when.none')} selected={value === null} onPress={() => onChange(null)} testID={testID ? `${testID}-none` : undefined} /> : null}
        {dayList.map((ms, index) => (
          <Chip key={ms} label={dayLabel(ms)} selected={day === ms} onPress={() => pickDay(ms)} testID={testID ? `${testID}-day-${index}` : undefined} />
        ))}
      </ScrollView>
      {withTime && value !== null ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {timesOfDay().map((minutes) => (
            <Chip key={minutes} label={clock.format(today + minutes * 60000)} selected={minute === minutes} onPress={() => pickTime(minutes)} testID={testID ? `${testID}-time-${minutes}` : undefined} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, paddingVertical: space.xs },
  row: { gap: space.xs },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
});
