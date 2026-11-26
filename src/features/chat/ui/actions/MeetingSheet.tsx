import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Pressable } from '../../../../ui/Pressable';
import { intlLocale } from '../../../../i18n/language';
import { radius, space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { TextField } from '../../../../ui/TextField';
import { meetingBusy, meetingDraft, scheduleMeeting, type Busy, type MeetingDraft, type Person, type Result } from '../../messageActions';
import { failureText } from './failure';
import { PersonChips, PersonSearch } from './PersonSearch';
import { WhenPicker } from './WhenPicker';
import { chipBand, chipHeight, chipSlop } from '../../../../ui/touch';

const durations = [15, 30, 45, 60, 90];

export function MeetingSheet({ channelId, messageId, onClose, onDone }: { channelId: number; messageId: number | null; onClose: () => void; onDone: (text: string) => void }) {
  const { t, i18n } = useTranslation('chat');
  const { colors } = useTheme();
  const locale = intlLocale(i18n.language === 'id' ? 'id' : 'en');
  const slotFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [locale]);
  const [draft, setDraft] = useState<Result<MeetingDraft> | null>(null);
  const [name, setName] = useState('');
  const [attendees, setAttendees] = useState<Person[]>([]);
  const [duration, setDuration] = useState(30);
  const [start, setStart] = useState<number | null>(null);
  const [busyPeople, setBusyPeople] = useState<Busy[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void meetingDraft(channelId, messageId).then((next) => {
      if (!live) return;
      setDraft(next);
      if (next.ok) {
        setName(next.value.name);
        setAttendees(next.value.attendees);
        setDuration(next.value.duration);
        setStart(next.value.slots[0]?.start ?? null);
      }
    });
    return () => {
      live = false;
    };
  }, [channelId, messageId]);
  const ids = attendees.map((person) => person.id).join(',');
  useEffect(() => {
    if (start === null || !ids) return;
    let live = true;
    const timer = setTimeout(() => {
      void meetingBusy(channelId, messageId, ids.split(',').map(Number), start, start + duration * 60000).then((result) => live && setBusyPeople(result.ok ? result.value : []));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [channelId, duration, ids, messageId, start]);
  const submit = async () => {
    if (start === null || !name.trim() || !attendees.length) return;
    setSaving(true);
    setError(null);
    const result = await scheduleMeeting({ channelId, messageId, name: name.trim(), partnerIds: attendees.map((person) => person.id), start, stop: start + duration * 60000 });
    setSaving(false);
    if (result.ok) onDone(t('meeting.done', { when: slotFormat.format(start) }));
    else setError(failureText(t, result));
  };
  const chip = (selected: boolean) => [styles.chip, { borderColor: selected ? colors.focus : colors.line, backgroundColor: selected ? colors.select : 'transparent' }];
  return (
    <Sheet
      title={t('meeting.title')}
      onClose={onClose}
      testID="meeting-sheet"
      footer={
        draft?.ok ? (
          <>
            {error ? (
              <Text variant="footnote" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button label={t('meeting.schedule')} disabled={start === null || !name.trim() || !attendees.length} busy={saving} onPress={() => void submit()} testID="meeting-schedule" />
          </>
        ) : null
      }>
      {!draft ? <ActivityIndicator color={colors.primary} style={styles.pad} /> : null}
      {draft && !draft.ok ? (
        <Text variant="callout" tone="danger">
          {failureText(t, draft)}
        </Text>
      ) : null}
      {draft?.ok ? (
        <>
          <TextField label={t('meeting.name')} value={name} onChangeText={setName} testID="meeting-name" />
          <Text variant="label" tone="inkSoft">
            {t('meeting.attendees')}
          </Text>
          <PersonChips people={attendees} onRemove={(person) => setAttendees((current) => current.filter((item) => item.id !== person.id))} testID="meeting-attendees" />
          <PersonSearch
            placeholder={t('meeting.addAttendee')}
            local={draft.value.members}
            exclude={attendees.map((person) => person.id)}
            onPick={(person) => setAttendees((current) => [...current, person])}
            testID="meeting-attendee-search"
          />
          <Text variant="label" tone="inkSoft" style={styles.gap}>
            {t('meeting.duration')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.row}>
            {durations.map((minutes) => (
              <Pressable key={minutes} accessibilityRole="button" accessibilityState={{ selected: duration === minutes }} onPress={() => setDuration(minutes)} hitSlop={chipSlop} style={chip(duration === minutes)}>
                <Text variant="footnote" tone={duration === minutes ? 'selectInk' : 'ink'}>
                  {t('meeting.minutes', { count: minutes })}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {draft.value.slots.length ? (
            <>
              <Text variant="label" tone="inkSoft" style={styles.gap}>
                {t('meeting.free')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.row}>
                {draft.value.slots.map((slot, index) => (
                  <Pressable key={slot.start} accessibilityRole="button" accessibilityState={{ selected: start === slot.start }} onPress={() => setStart(slot.start)} hitSlop={chipSlop} style={chip(start === slot.start)} testID={`meeting-slot-${index}`}>
                    <Text variant="footnote" tone={start === slot.start ? 'selectInk' : 'ink'}>
                      {slotFormat.format(slot.start)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
          <WhenPicker label={t('meeting.start')} value={start} onChange={setStart} testID="meeting-start" />
          {start !== null && ids && busyPeople.length ? (
            <Text variant="footnote" tone="warnInk" testID="meeting-busy">
              {t('meeting.busy', { names: [...new Set(busyPeople.map((item) => item.name))].join(', ') })}
            </Text>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.xl },
  gap: { marginTop: space.sm },
  row: { gap: space.xs, paddingVertical: chipBand.paddingVertical },
  chipBar: { marginVertical: chipBand.marginVertical },
  chip: { minHeight: chipHeight, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
});
