import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { TextField } from '../../../../ui/TextField';
import { makeTask, searchProjects, searchUsers, taskDraft, type Person, type Result, type TaskDraft } from '../../messageActions';
import type { Message } from '../../types';
import { failureText } from './failure';
import { PersonChips, PersonSearch } from './PersonSearch';
import { WhenPicker } from './WhenPicker';

export function TaskSheet({ message, onClose, onDone }: { message: Message; onClose: () => void; onDone: (text: string) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Result<TaskDraft> | null>(null);
  const [name, setName] = useState('');
  const [project, setProject] = useState<Person | null>(null);
  const [assignees, setAssignees] = useState<Person[]>([]);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void taskDraft(message.id).then((next) => {
      if (!live) return;
      setDraft(next);
      if (next.ok) {
        setName(next.value.name);
        setAssignees(next.value.assignees);
      }
    });
    return () => {
      live = false;
    };
  }, [message.id]);
  const submit = async () => {
    if (!draft?.ok || !name.trim()) return;
    setBusy(true);
    setError(null);
    const result = await makeTask({
      messageId: message.id,
      name: name.trim(),
      description: draft.value.description,
      projectId: project?.id ?? null,
      userIds: assignees.map((person) => person.id),
      deadline,
    });
    setBusy(false);
    if (result.ok) onDone(t('task.done', { name: name.trim() }));
    else setError(failureText(t, result));
  };
  return (
    <Sheet
      title={t('task.title')}
      onClose={onClose}
      testID="task-sheet"
      footer={
        draft?.ok ? (
          <>
            {error ? (
              <Text variant="footnote" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button label={t('task.create')} disabled={!name.trim()} busy={busy} onPress={() => void submit()} testID="task-create" />
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
          <TextField label={t('task.name')} value={name} onChangeText={setName} testID="task-name" />
          <Text variant="label" tone="inkSoft">
            {t('task.project')}
          </Text>
          {project ? <PersonChips people={[project]} onRemove={() => setProject(null)} /> : <PersonSearch placeholder={t('task.projectSearch')} search={searchProjects} onPick={setProject} testID="task-project" />}
          {!project ? (
            <Text variant="footnote" tone="inkSoft">
              {t('task.private')}
            </Text>
          ) : null}
          <Text variant="label" tone="inkSoft" style={styles.gap}>
            {t('task.assignees')}
          </Text>
          <PersonChips people={assignees} onRemove={(person) => setAssignees((current) => current.filter((item) => item.id !== person.id))} testID="task-assignees" />
          <PersonSearch
            placeholder={t('task.assigneeSearch')}
            search={searchUsers}
            exclude={assignees.map((person) => person.id)}
            onPick={(person) => setAssignees((current) => [...current, person])}
            testID="task-assignee-search"
          />
          <WhenPicker label={t('task.deadline')} value={deadline} onChange={setDeadline} allowNone testID="task-deadline" />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.xl },
  gap: { marginTop: space.sm },
});
