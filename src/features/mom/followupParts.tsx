import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { radius, space, stroke, useTheme } from '../../theme';
import type { IconName } from '../../ui/icons';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Chip } from '../discovery/ui';
import { dayFrom, isDay, urgencies, type FollowupRow, type Urgency } from './followups';
import { Line, useMomFormat } from './parts';
import { touchTarget } from '../../ui/touch';

const statusIcons: Record<string, IconName> = { draft: 'bulb', open: 'clock', late: 'alert', done: 'check', dropped: 'close' };
const statusTones = { draft: 'info', open: 'neutral', late: 'danger', done: 'ok', dropped: 'neutral' } as const;

export function useDueLabel() {
  const { t } = useTranslation();
  const format = useMomFormat();
  return (row: Pick<FollowupRow, 'deadline' | 'dueIn' | 'status'>) => {
    if (!row.deadline) return t('mom.followups.noDue');
    if (row.status === 'done' || row.dueIn === null) return t('mom.followups.dueOn', { day: format.day(row.deadline) });
    if (row.dueIn < 0) return t('mom.followups.late', { count: -row.dueIn });
    if (row.dueIn === 0) return t('mom.followups.dueToday');
    return t('mom.followups.dueIn', { count: row.dueIn });
  };
}

export function StatusChip({ row }: { row: Pick<FollowupRow, 'status' | 'statusLabel' | 'archived'> }) {
  const { t } = useTranslation();
  if (row.archived) return <Chip label={t('mom.followups.status.archived')} />;
  return <Chip label={row.statusLabel} tone={statusTones[row.status as keyof typeof statusTones] ?? 'neutral'} />;
}

export function FollowupLine({ row, onPress, selected }: { row: FollowupRow; onPress: () => void; selected?: boolean }) {
  const { t } = useTranslation();
  const due = useDueLabel();
  const owner = row.owner ? row.owner.name : row.ownerSaid || t('mom.followups.nobody');
  const detail = [owner, due(row), row.progress ? `${row.progress}%` : ''].filter(Boolean).join(' · ');
  return (
    <Line
      icon={statusIcons[row.status] ?? 'steps'}
      title={row.code ? `${row.code} · ${row.name}` : row.name}
      detail={detail}
      trailing={<StatusChip row={row} />}
      label={[row.code, row.name, row.archived ? t('mom.followups.status.archived') : row.statusLabel, detail].filter(Boolean).join(', ')}
      selected={selected}
      onPress={onPress}
      testID={`followup-${row.id}`}
    />
  );
}

export function ChoiceRow<T extends string | number>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices} keyboardShouldPersistTaps="handled">
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: chosen }}
            onPress={() => onChange(option.value)}
            testID={`${testID}-${option.value}`}
            style={[styles.choice, { borderColor: chosen ? colors.primary : colors.line, backgroundColor: chosen ? colors.select : colors.surface }]}>
            <Text variant="callout" style={{ color: chosen ? colors.selectInk : colors.ink }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function UrgencyChoice({ value, onChange }: { value: Urgency | ''; onChange: (next: Urgency | '') => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <Text variant="label" tone="inkSoft">
        {t('mom.followups.urgency')}
      </Text>
      <ChoiceRow
        options={[{ value: '' as Urgency | '', label: t('mom.followups.urgencies.none') }, ...urgencies.map((one) => ({ value: one as Urgency | '', label: t(`mom.followups.urgencies.${one}`) }))]}
        value={value}
        onChange={onChange}
        testID="followup-urgency"
      />
    </View>
  );
}

export function DueField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { t } = useTranslation();
  const wrong = !!value && !isDay(value);
  return (
    <View style={styles.field}>
      <TextField
        label={t('mom.followups.due')}
        hint={t('mom.followups.dueHint')}
        placeholder="YYYY-MM-DD"
        value={value}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        error={wrong ? t('mom.followups.dueWrong') : null}
        testID="followup-due"
      />
      <ChoiceRow
        options={[
          { value: dayFrom(0), label: t('mom.followups.today') },
          { value: dayFrom(1), label: t('mom.followups.tomorrow') },
          { value: dayFrom(7), label: t('mom.followups.nextWeek') },
          { value: dayFrom(30), label: t('mom.followups.nextMonth') },
        ]}
        value={value}
        onChange={onChange}
        testID="followup-due-quick"
      />
    </View>
  );
}

export function PickRow({ label, value, placeholder, onPress, testID }: { label: string; value: string; placeholder: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="label" tone="inkSoft">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.pick, { borderColor: colors.edge, backgroundColor: pressed ? colors.surface2 : colors.surface }]}>
        <Text tone={value ? 'ink' : 'inkSoft'} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  choices: { gap: space.sm, paddingVertical: space.xs },
  choice: { minHeight: touchTarget, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: stroke.thin, justifyContent: 'center' },
  pick: { minHeight: 48, borderRadius: radius.field, borderWidth: 1, paddingHorizontal: space.md, justifyContent: 'center' },
});
