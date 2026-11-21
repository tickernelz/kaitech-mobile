import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Check, Divider, Row, Section } from '../../ui/List';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { useCurrentProgramme } from '../discovery/Home';
import { Icon } from '../../ui/icons';
import { Segmented, StateView } from '../discovery/ui';
import { uploadOptions } from './api';
import { useMomFormat } from './parts';
import { start, type StartResult } from './recorder';

type Mode = 'new' | 'held';

export function clockIn(zone: string, at: Date): string {
  const parts: Record<string, string> = {};
  try {
    const format = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    for (const part of format.formatToParts(at)) parts[part.type] = part.value;
  } catch {
    const two = (value: number) => String(value).padStart(2, '0');
    Object.assign(parts, {
      year: String(at.getFullYear()),
      month: two(at.getMonth() + 1),
      day: two(at.getDate()),
      hour: two(at.getHours()),
      minute: two(at.getMinutes()),
      second: two(at.getSeconds()),
    });
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function SetupScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const format = useMomFormat();
  const { active } = useSession();
  const { list, current } = useCurrentProgramme();
  const programme = current?.id ?? 0;
  const options = useResource(programme ? `mom.options.${programme}` : null, (account) => uploadOptions(account, programme));
  const [mode, setMode] = useState<Mode>('new');
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [name, setName] = useState(() => t('mom.setup.defaultName', { date: format.day(new Date()) }));
  const [title, setTitle] = useState('');
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<StartResult | null>(null);
  const [busy, setBusy] = useState(false);

  const meetings = (options.data?.meetings ?? []).filter((meeting) => !meeting.signed);
  const chosen = mode === 'held' ? meetings.find((meeting) => meeting.id === meetingId) ?? null : null;
  const needsConsent = mode === 'new' || !chosen?.consent;
  const meetingName = mode === 'new' ? name.trim() : (chosen?.name ?? '');

  const begin = async () => {
    if (!active || !current) return;
    if (!meetingName) return setProblem(mode === 'new' ? t('mom.setup.nameNeeded') : t('mom.setup.meeting'));
    if (needsConsent && !consent) return setProblem(t('mom.setup.consentNeeded'));
    setProblem(null);
    setBusy(true);
    const now = new Date();
    const result = await start({
      account: active.id,
      programme: { id: current.id, name: current.name },
      meeting: chosen ? { id: chosen.id, name: chosen.name } : { name: meetingName, heldOn: clockIn(options.data?.zone ?? 'UTC', now) },
      title: title.trim() || meetingName,
      ...(needsConsent ? { consentNote: t('mom.consentNote', { time: format.time(now) }), consentAt: now.getTime() } : {}),
    });
    setBusy(false);
    setOutcome(result);
    if (result === 'started') router.replace('/mom/record');
  };

  if (!current) {
    return (
      <Screen testID="mom-setup">
        <Header title={t('mom.setup.title')} />
        <StateView
          loading={list.loading && !list.data}
          error={list.data ? undefined : list.error}
          empty={{ title: t('mom.setup.noProgramme') }}
          onRetry={() => void list.refresh()}
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      testID="mom-setup"
      footer={
        <>
          {outcome && outcome !== 'started' ? (
            <Text variant="callout" tone="dangerInk" accessibilityRole="alert" testID="setup-outcome">
              {t(`mom.setup.${outcome}`)}
            </Text>
          ) : null}
          {outcome === 'denied' ? <Button kind="secondary" label={t('mom.setup.openSettings')} onPress={() => void Linking.openSettings()} /> : null}
          <Button label={t('mom.setup.start')} onPress={() => void begin()} busy={busy} testID="setup-start" />
        </>
      }>
      <Header title={t('mom.setup.title')} />
      <View style={styles.group}>
        <Text variant="label" tone="inkSoft">
          {t('mom.setup.programme')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('mom.setup.programme')}: ${current.name}`}
          onPress={() => router.push('/program/pick')}
          testID="setup-programme"
          style={({ pressed }) => [styles.switch, { backgroundColor: pressed ? colors.select : colors.surface, borderColor: colors.line }]}>
          <Text variant="callout" tone="selectInk" numberOfLines={2} style={styles.shrink}>
            {current.name}
          </Text>
          <Icon name="chevronDown" size={20} color={colors.selectInk} />
        </Pressable>
      </View>
      <View style={styles.group}>
        <Text variant="label" tone="inkSoft">
          {t('mom.setup.meeting')}
        </Text>
        <Segmented
          value={mode}
          onChange={(next) => {
            setMode(next);
            setProblem(null);
          }}
          options={[
            { value: 'new', label: t('mom.setup.newMeeting') },
            { value: 'held', label: t('mom.setup.heldMeeting') },
          ]}
          testID="setup-mode"
        />
      </View>
      {mode === 'new' ? (
        <TextField label={t('mom.setup.meetingName')} value={name} onChangeText={setName} testID="setup-name" returnKeyType="next" />
      ) : options.data ? (
        meetings.length ? (
          <Section>
            {meetings.map((meeting, index) => (
              <View key={meeting.id}>
                {index ? <Divider /> : null}
                <Row
                  title={meeting.name}
                  detail={meeting.held_on}
                  selected={meeting.id === meetingId}
                  trailing={<Check visible={meeting.id === meetingId} />}
                  onPress={() => setMeetingId(meeting.id)}
                  testID={`setup-meeting-${meeting.id}`}
                />
              </View>
            ))}
          </Section>
        ) : (
          <Text tone="inkSoft">{t('mom.setup.noMeetings')}</Text>
        )
      ) : (
        <StateView loading={options.loading} error={options.error} onRetry={() => void options.refresh()} />
      )}
      <TextField
        label={t('mom.setup.recordingTitle')}
        value={title}
        placeholder={meetingName}
        onChangeText={setTitle}
        testID="setup-title"
      />
      {needsConsent ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: consent }}
          accessibilityLabel={t('mom.setup.consent')}
          accessibilityHint={t('mom.setup.consentHint')}
          onPress={() => setConsent((value) => !value)}
          testID="setup-consent"
          style={({ pressed }) => [styles.consent, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: consent ? colors.primary : colors.line }]}>
          <View style={styles.consentText}>
            <Text variant="callout">{t('mom.setup.consent')}</Text>
            <Text variant="footnote" tone="inkSoft">
              {t('mom.setup.consentHint')}
            </Text>
          </View>
          <Switch
            value={consent}
            onValueChange={setConsent}
            importantForAccessibility="no"
            accessibilityElementsHidden
            trackColor={{ true: colors.primary, false: colors.lineStrong }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.lineStrong}
          />
        </Pressable>
      ) : (
        <Text variant="footnote" tone="okInk">
          {t('mom.setup.consentKnown')}
        </Text>
      )}
      {problem ? (
        <Text variant="callout" tone="dangerInk" accessibilityRole="alert" testID="setup-problem">
          {problem}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  consent: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  consentText: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
