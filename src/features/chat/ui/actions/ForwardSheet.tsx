import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Sheet, SheetRow } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { forwardDraft, forwardTo, type ForwardDraft, type Result } from '../../messageActions';
import type { Message } from '../../types';
import { failureText } from './failure';

export function ForwardSheet({ message, onClose, onDone }: { message: Message; onClose: () => void; onDone: (text: string) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Result<ForwardDraft> | null>(null);
  const [picked, setPicked] = useState<number[]>([message.id]);
  const [more, setMore] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void forwardDraft(message.id).then((next) => live && setDraft(next));
    return () => {
      live = false;
    };
  }, [message.id]);
  const targets = useMemo(() => {
    if (!draft?.ok) return [];
    const needle = query.trim().toLowerCase();
    return needle ? draft.value.targets.filter((item) => item.name.toLowerCase().includes(needle)) : draft.value.targets;
  }, [draft, query]);
  const toggle = (id: number) => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id].sort((a, b) => a - b)));
  const submit = async () => {
    if (!target || !picked.length || !draft?.ok) return;
    setBusy(true);
    setError(null);
    const result = await forwardTo(target, picked);
    setBusy(false);
    if (!result.ok) {
      setError(failureText(t, result));
      return;
    }
    const name = draft.value.targets.find((item) => item.id === target)?.name ?? '';
    onDone(t('forward.done', { count: result.value.count, name }));
  };
  return (
    <Sheet
      title={t('forward.title')}
      onClose={onClose}
      testID="forward-sheet"
      footer={
        draft?.ok ? (
          <>
            {error ? (
              <Text variant="footnote" tone="danger">
                {error}
              </Text>
            ) : null}
            <Button label={t('forward.send', { count: picked.length })} disabled={!target || !picked.length} busy={busy} onPress={() => void submit()} testID="forward-send" />
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
          <SheetRow icon="chat" label={t('forward.picked', { count: picked.length })} detail={more ? undefined : t('forward.pickMore')} onPress={() => setMore((value) => !value)} testID="forward-more" />
          {more
            ? draft.value.messages.map((item) => (
                <SheetRow
                  key={item.id}
                  label={item.preview || t('list.files', { count: item.files })}
                  detail={item.author}
                  selected={picked.includes(item.id)}
                  onPress={() => toggle(item.id)}
                  testID={`forward-message-${item.id}`}
                />
              ))
            : null}
          <Text variant="label" tone="inkSoft" style={styles.gap}>
            {t('forward.to')}
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('forward.search')}
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel={t('forward.search')}
            style={[styles.input, { backgroundColor: colors.surface2, color: colors.ink }]}
            testID="forward-search"
          />
          {targets.map((item) => (
            <SheetRow
              key={item.id}
              icon={item.kind === 'chat' ? 'chat' : item.kind === 'group' ? 'people' : 'hash'}
              label={item.name}
              selected={target === item.id}
              onPress={() => setTarget(item.id)}
              testID={`forward-target-${item.id}`}
            />
          ))}
          {!targets.length ? (
            <View style={styles.pad}>
              <Text variant="callout" tone="inkSoft">
                {t('forward.noTargets')}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
  gap: { marginTop: space.md },
  input: { minHeight: 44, borderRadius: radius.field, paddingHorizontal: space.md, fontSize: 16 },
});
