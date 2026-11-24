import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Pressable } from '../../../../ui/Pressable';
import { radius, space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { TextField } from '../../../../ui/TextField';
import { activityDraft, makeActivity, type ActivityDraft, type Result } from '../../messageActions';
import type { Message } from '../../types';
import { failureText } from './failure';
import { WhenPicker } from './WhenPicker';

export function ActivitySheet({ message, onClose, onDone }: { message: Message; onClose: () => void; onDone: (text: string) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Result<ActivityDraft> | null>(null);
  const [summary, setSummary] = useState('');
  const [typeId, setTypeId] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void activityDraft(message.id).then((next) => {
      if (!live) return;
      setDraft(next);
      if (next.ok) setSummary(next.value.summary);
    });
    return () => {
      live = false;
    };
  }, [message.id]);
  const submit = async () => {
    if (!draft?.ok || deadline === null) return;
    setBusy(true);
    setError(null);
    const result = await makeActivity({ summary: summary.trim(), note: draft.value.note, typeId, deadline, context: draft.value.context });
    setBusy(false);
    if (result.ok) onDone(t('activity.done'));
    else setError(failureText(t, result));
  };
  return (
    <Sheet
      title={t('activity.title')}
      onClose={onClose}
      testID="activity-sheet"
      footer={
        draft?.ok ? (
          <>
            {error ? (
              <Text variant="footnote" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button label={t('activity.create')} disabled={deadline === null} busy={busy} onPress={() => void submit()} testID="activity-create" />
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
          <TextField label={t('activity.summary')} value={summary} onChangeText={setSummary} testID="activity-summary" />
          {draft.value.types.length ? (
            <>
              <Text variant="label" tone="inkSoft">
                {t('activity.type')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {draft.value.types.map((type) => (
                  <Pressable
                    key={type.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: typeId === type.id }}
                    onPress={() => setTypeId(typeId === type.id ? null : type.id)}
                    style={[styles.chip, { borderColor: typeId === type.id ? colors.focus : colors.line, backgroundColor: typeId === type.id ? colors.select : 'transparent' }]}
                    testID={`activity-type-${type.id}`}>
                    <Text variant="footnote" tone={typeId === type.id ? 'selectInk' : 'ink'}>
                      {type.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
          <WhenPicker label={t('activity.due')} value={deadline} onChange={setDeadline} withTime={false} testID="activity-due" />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.xl },
  row: { gap: space.xs },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
});
