import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { IconButton } from '../../ui/IconButton';
import { dayOf, isoDay } from './odoo';
import { monthCells } from './rules';

export function DateGrid({ value, onChange, testID }: { value: string; onChange: (iso: string) => void; testID?: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const today = isoDay(new Date());
  const selected = dayOf(value) ?? new Date();
  const [shown, setShown] = useState({ year: selected.getFullYear(), month: selected.getMonth() });
  const weekStartsOn = i18n.language === 'id' ? 1 : 0;
  const cells = useMemo(() => monthCells(shown.year, shown.month, weekStartsOn), [shown, weekStartsOn]);
  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(shown.year, shown.month, 1));
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + ((index + weekStartsOn) % 7))),
  );
  const fullDate = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' });
  const step = (delta: number) => setShown(({ year, month }) => ({ year: year + Math.floor((month + delta) / 12), month: (month + delta + 12) % 12 }));
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.head}>
        <IconButton icon="back" label={t('date.previous')} onPress={() => step(-1)} testID={testID ? `${testID}-previous` : undefined} />
        <Text variant="callout" style={styles.month} accessibilityLiveRegion="polite">
          {monthLabel}
        </Text>
        <IconButton icon="forward" label={t('date.next')} onPress={() => step(1)} testID={testID ? `${testID}-next` : undefined} />
      </View>
      <View style={styles.row}>
        {weekdays.map((day, index) => (
          <Text key={index} variant="footnote" tone="inkFaint" style={styles.cell}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) return <View key={index} style={styles.cell} />;
          const iso = isoDay(day);
          const isSelected = iso === value;
          const isToday = iso === today;
          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={fullDate.format(day)}
              onPress={() => onChange(iso)}
              style={styles.cell}
              testID={testID ? `${testID}-${iso}` : undefined}>
              <View
                style={[
                  styles.day,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && isToday && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.primary },
                ]}>
                <Text variant="callout" style={{ color: isSelected ? colors.onPrimary : colors.ink }}>
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center' },
  month: { flex: 1, textAlign: 'center' },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: 44, textAlign: 'center' },
  day: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
