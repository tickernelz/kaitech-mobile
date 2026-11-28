import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../api/odoo';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { localFile } from '../chat/files';
import { Header } from '../discovery/Header';
import { Card, Chip, StateView, useErrorText } from '../discovery/ui';
import {
  acceptTask,
  attachToNote,
  draftTasks,
  dropTask,
  isLive,
  manualNotes,
  readAttachmentAgain,
  removeAttachment,
  saveNote,
  setTask,
  tasksOverview,
  type AssistPart,
  type DraftTask,
  type ManualNotes,
  type TasksOverview,
} from './assist';
import { DueField, PickRow } from './followupParts';
import { isDay } from './followups';
import { MoreSheet } from './MoreSheet';
import { SmallButton } from './parts';
import { assistKey, Scroll, useAssistRun, usePoll } from './assistParts';
import { SolusiPanel } from './SolusiPanel';
import { choose, confirm, notify } from '../../ui/dialog';

export function AssistScreen({ part, meeting }: { part: AssistPart; meeting: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={`assist-${part}`}>
      <Header title={t(`mom.assist.${part}.title`)} />
      {part === 'notes' ? <Notes meeting={meeting} /> : part === 'tasks' ? <Tasks meeting={meeting} /> : <SolusiPanel meeting={meeting} />}
    </SafeAreaView>
  );
}

function Notes({ meeting }: { meeting: number }) {
  const notes = useResource(assistKey('notes', meeting), (account) => manualNotes(account, meeting), 0);
  usePoll(!!notes.data?.pending, notes.refresh);
  if (!notes.data) return <StateView loading={!notes.error} error={notes.error} onRetry={() => void notes.refresh()} testID="assist-notes" />;
  return <NotesForm key={notes.data.note ? notes.data.note.stamp : 'new'} data={notes.data} meeting={meeting} onRefresh={notes.refresh} />;
}

function NotesForm({ data, meeting, onRefresh }: { data: ManualNotes; meeting: number; onRefresh: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const action = useAssistRun('notes', meeting);
  const { active } = useSession();
  const errorText = useErrorText();
  const [body, setBody] = useState(data.note ? data.note.body : '');
  const [saving, setSaving] = useState(false);
  const stamp = data.note ? data.note.stamp : null;
  const save = async (seen: string | null) => {
    if (!active || saving) return;
    setSaving(true);
    try {
      await saveNote(active, meeting, body, seen);
      invalidate(`${active.id}:${assistKey('notes', meeting)}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'refused' && seen) {
        void choose({
          title: t('mom.assist.notes.conflictTitle'),
          body: error.detail?.trim() || t('mom.assist.notes.conflictBody'),
          testID: 'notes-conflict-dialog',
          choices: [
            { key: 'theirs', label: t('mom.assist.notes.useTheirs'), tone: 'plain' },
            { key: 'mine', label: t('mom.assist.notes.keepMine'), tone: 'primary' },
          ],
        }).then((picked) => {
          if (picked === 'theirs') void onRefresh();
          if (picked === 'mine') void save(null);
        });
      } else notify(errorText(error));
    } finally {
      setSaving(false);
    }
  };
  const attach = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    const file = picked.canceled ? null : picked.assets[0];
    if (!file) return;
    if (data.maxBytes && (file.size ?? 0) > data.maxBytes) {
      notify(t('mom.assist.notes.tooBig', { mb: Math.round(data.maxBytes / 1048576) }));
      return;
    }
    await action.run('attach', async (account) =>
      attachToNote(account, meeting, { name: file.name, mimetype: file.mimeType || 'application/octet-stream', data: await localFile(file.uri).base64() }),
    );
  };
  const full = data.maxFiles > 0 && data.attachments.length >= data.maxFiles;
  return (
    <Scroll onRefresh={onRefresh}>
      <Text tone="inkSoft">{t('mom.assist.notes.hint')}</Text>
      {data.note ? (
        <Text variant="footnote" tone="inkSoft">
          {[data.note.by, data.note.inKnowledge ? t('mom.assist.notes.inKnowledge') : ''].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      <TextField label={t('mom.assist.notes.body')} value={body} onChangeText={setBody} multiline editable={data.canChange} testID="assist-note-body" />
      {data.canChange ? (
        <Button label={t('mom.followups.save')} onPress={() => void save(stamp)} disabled={body === (data.note ? data.note.body : '')} busy={saving} testID="assist-note-save" />
      ) : null}
      <Section title={t('mom.assist.notes.files', { count: data.attachments.length, max: data.maxFiles })}>
        {data.attachments.length ? (
          data.attachments.map((file) => (
            <Row
              key={file.id}
              title={file.name}
              detail={[file.stateLabel, file.error, file.chars ? t('mom.assist.notes.chars', { count: file.chars }) : '', file.uploadedBy].filter(Boolean).join(' · ')}
              trailing={
                data.canChange ? (
                  <View style={styles.row}>
                    {file.error || file.state === 'failed' ? (
                      <SmallButton label={t('mom.assist.notes.readAgain')} onPress={() => void action.run(`again-${file.id}`, (account) => readAttachmentAgain(account, file.id))} testID={`note-again-${file.id}`} />
                    ) : null}
                    <SmallButton tone="dangerInk" label={t('mom.assist.notes.remove')} onPress={() => void action.run(`remove-${file.id}`, (account) => removeAttachment(account, file.id))} testID={`note-remove-${file.id}`} />
                  </View>
                ) : undefined
              }
            />
          ))
        ) : (
          <Row title={t('mom.assist.notes.noFiles')} />
        )}
      </Section>
      {data.canChange && !full ? <Button kind="secondary" label={t('mom.assist.notes.attach')} onPress={() => void attach()} busy={action.busy === 'attach'} testID="assist-note-attach" /> : null}
    </Scroll>
  );
}

function Tasks({ meeting }: { meeting: number }) {
  const { t } = useTranslation();
  const tasks = useResource(assistKey('tasks', meeting), (account) => tasksOverview(account, meeting), 0);
  const action = useAssistRun('tasks', meeting);
  usePoll(isLive(tasks.data?.job), tasks.refresh);
  const data = tasks.data;
  if (!data) return <StateView loading={!tasks.error} error={tasks.error} onRetry={() => void tasks.refresh()} testID="assist-tasks" />;
  return (
    <Scroll onRefresh={tasks.refresh}>
      {data.job && (data.job.label || data.job.message) ? (
        <Text variant="footnote" tone="inkSoft" accessibilityRole="alert">
          {[data.job.label, data.job.message].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {data.approvedWaiting ? <Text tone="inkSoft">{t('mom.assist.tasks.approvedWaiting', { count: data.approvedWaiting })}</Text> : null}
      {data.canChange && !isLive(data.job) ? (
        <View style={styles.row}>
          <Button kind="secondary" label={t('mom.assist.tasks.fromSolusi')} onPress={() => void action.run('solusi', (account) => draftTasks(account, meeting, 'solusi'))} busy={action.busy === 'solusi'} style={styles.flex} testID="tasks-from-solusi" />
          <Button kind="secondary" label={t('mom.assist.tasks.fromMinutes')} onPress={() => void action.run('minutes', (account) => draftTasks(account, meeting, 'minutes'))} busy={action.busy === 'minutes'} style={styles.flex} testID="tasks-from-minutes" />
        </View>
      ) : null}
      {data.tasks.length ? data.tasks.map((task) => <TaskCard key={task.id} task={task} data={data} meeting={meeting} />) : <StateView empty={{ title: t('mom.assist.tasks.none'), icon: 'steps' }} />}
    </Scroll>
  );
}

function TaskCard({ task, data, meeting }: { task: DraftTask; data: TasksOverview; meeting: number }) {
  const { t } = useTranslation();
  const action = useAssistRun('tasks', meeting);
  const [picking, setPicking] = useState(false);
  const [deadline, setDeadline] = useState(task.deadline || '');
  const draft = task.state === 'proposed' || task.state === 'draft';
  const editable = data.canChange && draft;
  const ready = !!task.ownerId && !!task.deadline;
  return (
    <Card testID={`task-${task.id}`}>
      <View style={styles.row}>
        <Chip label={task.stateLabel} tone={draft ? 'info' : 'ok'} />
        {task.categoryLabel ? <Chip label={task.categoryLabel} /> : null}
      </View>
      <Text variant="headline">{task.name}</Text>
      {task.description ? <Text variant="callout">{task.description}</Text> : null}
      <Text variant="footnote" tone="inkSoft">
        {[task.solusiItem, task.draftedBy === 'coworker' ? t('mom.assist.coworker') : ''].filter(Boolean).join(' · ')}
      </Text>
      {task.meetingSaid ? (
        <Text variant="footnote" tone={task.meetingSaid.differs ? 'warnInk' : 'inkSoft'}>
          {t(task.meetingSaid.differs ? 'mom.assist.tasks.saidDiffers' : 'mom.assist.tasks.said', { said: [task.meetingSaid.owner, task.meetingSaid.due].filter(Boolean).join(' · ') })}
        </Text>
      ) : null}
      {task.quote ? <Text variant="callout">{`"${task.quote}"`}</Text> : null}
      {task.reason ? <Text variant="footnote" tone="inkSoft">{task.reason}</Text> : null}
      {task.duplicateOf ? (
        <Text variant="footnote" tone="warnInk">
          {t('mom.assist.tasks.duplicate', { name: task.duplicateOf.name })}
        </Text>
      ) : null}
      {editable ? (
        <>
          <PickRow label={t('mom.followups.owner')} value={task.owner} placeholder={t('mom.setup.choose')} onPress={() => setPicking(true)} testID={`task-owner-${task.id}`} />
          <DueField value={deadline} onChange={setDeadline} />
          {deadline !== (task.deadline || '') && (!deadline || isDay(deadline)) ? (
            <SmallButton label={t('mom.assist.tasks.saveDue')} onPress={() => void action.run('due', (account) => setTask(account, task.id, { deadline: deadline || false }))} testID={`task-due-save-${task.id}`} />
          ) : null}
          <View style={styles.row}>
            {data.canAccept ? (
              <Button label={t('mom.followups.agree')} disabled={!ready} onPress={() => void action.run('accept', (account) => acceptTask(account, task.id))} busy={action.busy === 'accept'} style={styles.flex} testID={`task-accept-${task.id}`} />
            ) : null}
            <Button
              kind="danger"
              label={t('mom.assist.tasks.drop')}
              onPress={() =>
                void confirm({ title: t('mom.assist.tasks.dropTitle'), body: task.name, cancel: t('mom.recorder.cancel'), confirm: t('mom.assist.tasks.drop'), danger: true, icon: 'trash', testID: 'task-drop-dialog' }).then(async (go) => {
                  if (go) await action.run('drop', (account) => dropTask(account, task.id));
                })
              }
              style={styles.flex}
              testID={`task-drop-${task.id}`}
            />
          </View>
          {!ready ? (
            <Text variant="footnote" tone="inkSoft">
              {t('mom.assist.tasks.missing')}
            </Text>
          ) : null}
        </>
      ) : (
        <Text variant="footnote" tone="inkSoft">
          {[task.owner, task.deadline].filter(Boolean).join(' · ')}
        </Text>
      )}
      {picking ? (
        <MoreSheet
          title={t('mom.followups.owner')}
          groups={[{ key: 'people', actions: data.people.map((one) => ({ key: `owner-${one.id}`, icon: 'people' as const, label: one.name, onPress: () => void action.run('owner', (account) => setTask(account, task.id, { owner_profile_id: one.id })) })) }]}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
