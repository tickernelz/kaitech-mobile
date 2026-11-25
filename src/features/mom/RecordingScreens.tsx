import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Check, Row, Section } from '../../ui/List';
import { Header } from '../discovery/Header';
import { StateView, useErrorText } from '../discovery/ui';
import { Scroll } from './assistParts';
import { fileUnderDepartment, meetingRecordings, recordingHistory, setClientDepartments, type MeetingRecordings, type RecordingCard } from './records';
import { notify } from '../../ui/dialog';

export function RecordingHistoryScreen({ recording }: { recording: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const history = useResource(`mom.history.${recording}`, (account) => recordingHistory(account, recording));
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="recording-history">
      <Header title={t('mom.recordingMenu.history')} />
      {history.data ? (
        <Scroll refreshing={history.loading} onRefresh={() => void history.refresh()}>
          <Section>
            {history.data.length ? (
              history.data.map((line) => <Row key={line.id} title={[line.body, ...line.changes].filter(Boolean).join('\n') || '-'} detail={[line.author, line.date].filter(Boolean).join(' · ')} />)
            ) : (
              <Row title={t('mom.records.none')} />
            )}
          </Section>
        </Scroll>
      ) : (
        <StateView loading={!history.error} error={history.error} onRetry={() => void history.refresh()} testID="recording-history" />
      )}
    </SafeAreaView>
  );
}

export function RecordingDepartmentsScreen({ recording, meeting }: { recording: number; meeting: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const board = useResource(`mom.recordings.${meeting}`, (account) => meetingRecordings(account, meeting));
  const card = board.data?.recordings.find((one) => one.id === recording);
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="recording-departments">
      <Header title={t('mom.recordingMenu.departments')} subtitle={card?.name} />
      {board.data && card ? (
        <Departments key={card.id} board={board.data} card={card} meeting={meeting} />
      ) : (
        <StateView loading={!board.error && !board.data} error={board.error} empty={{ title: t('mom.removeScreen.gone') }} onRetry={() => void board.refresh()} />
      )}
    </SafeAreaView>
  );
}

function Departments({ board, card, meeting }: { board: MeetingRecordings; card: RecordingCard; meeting: number }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { active } = useSession();
  const programme = String(card.engagement.id);
  const own = board.departmentsByProgramme?.[programme] ?? [];
  const served = board.clientDepartmentsByProgramme?.[programme] ?? [];
  const [chosen, setChosen] = useState(card.clientDepartments.map((one) => one.id));
  const [busy, setBusy] = useState('');
  const run = async (name: string, work: () => Promise<unknown>) => {
    if (!active || busy) return;
    setBusy(name);
    try {
      await work();
      invalidate(`${active.id}:mom.`);
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy('');
    }
  };
  const editable = board.canChange;
  const toggle = (id: number) => setChosen((list) => (list.includes(id) ? list.filter((one) => one !== id) : [...list, id]));
  const changed = [...chosen].sort().join(',') !== card.clientDepartments.map((one) => one.id).sort().join(',');
  return (
    <Scroll refreshing={false} onRefresh={() => undefined}>
      {!board.isClient ? (
        <Section title={t('mom.recordingMenu.filedUnder')}>
          {[{ id: 0, name: t('mom.clientOrg.noDepartment') }, ...own].map((one) => {
            const selected = (card.department ? card.department.id : 0) === one.id;
            return (
              <Row
                key={one.id}
                title={one.name}
                selected={selected}
                trailing={<Check visible={selected} />}
                onPress={editable && !selected && active ? () => void run('file', () => fileUnderDepartment(active, card.id, one.id || false)) : undefined}
                testID={`recording-department-${one.id}`}
              />
            );
          })}
        </Section>
      ) : null}
      <Section title={t('mom.recordingMenu.serves')}>
        {served.length ? (
          served.map((one) => (
            <Row key={one.id} title={one.name} selected={chosen.includes(one.id)} trailing={<Check visible={chosen.includes(one.id)} />} onPress={editable ? () => toggle(one.id) : undefined} testID={`recording-served-${one.id}`} />
          ))
        ) : (
          <Row title={t('mom.recordingMenu.noClientDepartments')} />
        )}
      </Section>
      {editable && changed ? (
        <Button label={t('mom.followups.save')} busy={busy === 'served'} onPress={() => active && void run('served', () => setClientDepartments(active, card.id, chosen))} testID="recording-served-save" />
      ) : null}
    </Scroll>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
