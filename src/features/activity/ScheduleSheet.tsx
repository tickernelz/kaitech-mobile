import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Sheet, SheetItem } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { chipBand, chipHeight, chipSlop } from '../../ui/touch';
import { useErrorText } from '../discovery/ui';
import { DateGrid } from './DateGrid';
import { useDueLabel } from './due';
import { orderedTypes } from './rules';
import {
  activityTypes,
  defaultDeadline,
  edit,
  isoDay,
  people,
  schedule,
  scheduleTodo,
  type Activity,
  type ActivityType,
  type Person,
} from './odoo';

export type ScheduleMode =
  | { kind: 'edit'; activity: Activity }
  | { kind: 'record'; resModel: string; resId: number; resName: string; previousTypeId: number | null }
  | { kind: 'todo' };

function shifted(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() + days);
  return isoDay(day);
}

export function ScheduleSheet({ mode, onClose, onSaved }: { mode: ScheduleMode; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const errorText = useErrorText();
  const due = useDueLabel();
  const model = mode.kind === 'edit' ? mode.activity.resModel : mode.kind === 'record' ? mode.resModel : null;
  const types = useResource(model ? `activity.types.${model}` : null, (account) => activityTypes(account, model), 600_000);
  const ordered = useMemo(() => orderedTypes(types.data ?? [], mode.kind === 'record' ? mode.previousTypeId : null), [types.data, mode]);
  const initial = mode.kind === 'edit' ? mode.activity : null;
  const [typeId, setTypeId] = useState<number | null>(initial?.typeId ?? null);
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [chosenDeadline, setDeadline] = useState<string | null>(initial?.deadline || null);
  const [assignee, setAssignee] = useState<Person | null>(
    initial ? (initial.userId ? { id: initial.userId, name: initial.userName } : null) : active ? { id: active.userId, name: active.name } : null,
  );
  const [picking, setPicking] = useState<'date' | 'person' | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const chosenType = typeId ?? (mode.kind === 'edit' ? null : (ordered[0]?.id ?? null));
  const deadline = chosenDeadline ?? defaultDeadline(ordered.find((type) => type.id === chosenType), new Date());

  useEffect(() => {
    if (picking !== 'person' || !active) return;
    let live = true;
    const timer = setTimeout(() => {
      people(active, query.trim())
        .then((rows) => live && setFound(rows))
        .catch(() => live && setFound([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [picking, query, active]);

  const pickType = (type: ActivityType) => {
    setTypeId(type.id);
    if (mode.kind !== 'edit') setDeadline(null);
  };

  const save = async () => {
    if (!active || busy) return;
    setBusy(true);
    setFailed(null);
    const input = { typeId: chosenType, summary, note, deadline, userId: assignee?.id ?? null };
    try {
      if (mode.kind === 'edit') await edit(active, mode.activity.id, input);
      else if (mode.kind === 'record') await schedule(active, mode, input);
      else await scheduleTodo(active, input);
      onSaved();
    } catch (error) {
      setFailed(errorText(error));
      setBusy(false);
    }
  };

  const title = mode.kind === 'edit' ? t('activities.editTitle') : mode.kind === 'todo' ? t('activities.todoTitle') : t('activities.scheduleTitle');
  const detail = mode.kind === 'edit' ? mode.activity.resName : mode.kind === 'record' ? mode.resName : undefined;
  const quick: { key: string; label: string; iso: string }[] = [
    { key: 'today', label: t('activities.snooze.today'), iso: shifted(0) },
    { key: 'tomorrow', label: t('activities.snooze.tomorrow'), iso: shifted(1) },
    { key: 'week', label: t('activities.inAWeek'), iso: shifted(7) },
  ];

  return (
    <Sheet title={title} detail={detail} onClose={onClose} testID="activity-schedule">
      {mode.kind !== 'todo' && ordered.length ? (
        <View style={styles.block}>
          <Text variant="label" tone="inkSoft">
            {t('activities.type')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
            {ordered.map((type) => (
              <Choice key={type.id} label={type.name} selected={type.id === chosenType} onPress={() => pickType(type)} testID={`activity-type-${type.id}`} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <TextField label={t('activities.summary')} value={summary} onChangeText={setSummary} maxLength={200} testID="activity-summary" />
      <View style={styles.block}>
        <Text variant="label" tone="inkSoft">
          {t('activities.due')}
        </Text>
        <View style={[styles.chips, styles.chipBar]}>
          {quick.map((option) => (
            <Choice key={option.key} label={option.label} selected={deadline === option.iso} onPress={() => setDeadline(option.iso)} testID={`activity-due-${option.key}`} />
          ))}
          <Choice
            label={quick.some((option) => option.iso === deadline) ? t('activities.pickDate') : due(deadline)}
            selected={!quick.some((option) => option.iso === deadline)}
            onPress={() => setPicking(picking === 'date' ? null : 'date')}
            testID="activity-due-pick"
          />
        </View>
        {picking === 'date' ? <DateGrid value={deadline} onChange={(iso) => setDeadline(iso)} testID="activity-date" /> : null}
      </View>
      {mode.kind !== 'todo' ? (
        <View style={styles.block}>
          <Text variant="label" tone="inkSoft">
            {t('activities.assignedTo')}
          </Text>
          <SheetItem
            icon="people"
            label={assignee?.name ?? t('activities.nobody')}
            onPress={() => setPicking(picking === 'person' ? null : 'person')}
            testID="activity-assignee"
          />
          {picking === 'person' ? (
            <View style={[styles.people, { borderColor: colors.line }]}>
              <TextField label={t('activities.findPerson')} value={query} onChangeText={setQuery} autoFocus testID="activity-assignee-search" />
              {found.map((person) => (
                <SheetItem
                  key={person.id}
                  icon={person.id === assignee?.id ? 'check' : 'people'}
                  label={person.name}
                  onPress={() => {
                    setAssignee(person);
                    setPicking(null);
                  }}
                  testID={`activity-assignee-${person.id}`}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <TextField label={t('activities.note')} value={note} onChangeText={setNote} multiline style={styles.note} testID="activity-note" />
      {failed ? (
        <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="activity-schedule-error">
          {failed}
        </Text>
      ) : null}
      <Button label={mode.kind === 'edit' ? t('activities.save') : t('activities.schedule')} busy={busy} onPress={() => void save()} testID="activity-schedule-save" />
    </Sheet>
  );
}

function Choice({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={chipSlop}
      style={[styles.choice, { backgroundColor: selected ? colors.select : colors.surface, borderColor: selected ? colors.select : colors.line }]}
      testID={testID}>
      <Text variant="footnote" style={{ color: selected ? colors.selectInk : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs, paddingVertical: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingVertical: chipBand.paddingVertical },
  chipBar: { marginVertical: chipBand.marginVertical },
  choice: { minHeight: chipHeight, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  people: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.sm, gap: space.xs },
  note: { minHeight: 88, textAlignVertical: 'top' },
});
