import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { ApiError } from '../../api/odoo';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { space } from '../../theme';
import { Button } from '../../ui/Button';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { parseServerDate } from '../discovery/dates';
import { Segmented, useErrorText } from '../discovery/ui';
import { messages, postNote, type Message } from './api';
import { plainOfHtml } from './model';

export function useFailureAlert() {
  const errorText = useErrorText();
  return useCallback(
    (error: unknown) => {
      Alert.alert('', error instanceof ApiError && error.said && error.code !== 'server' ? error.said : errorText(error));
    },
    [errorText],
  );
}

export function Chatter({ model, id, generation }: { model: string; id: number; generation: number }) {
  const { t } = useTranslation();
  const { date } = useFormatters();
  const account = useSession().active;
  const fail = useFailureAlert();
  const [rows, setRows] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'note' | 'message'>('note');
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(true);

  const load = useCallback(
    async (offset: number) => {
      if (!account) return;
      try {
        const page = await messages(account, model, id, offset);
        setMore(page.length === 30);
        setRows((current) => (offset ? [...(current ?? []), ...page] : page));
      } catch {
        setRows((current) => current ?? []);
      }
    },
    [account, model, id],
  );

  useEffect(() => {
    if (!account) return;
    let live = true;
    messages(account, model, id, 0)
      .then((page) => {
        if (!live) return;
        setMore(page.length === 30);
        setRows(page);
      })
      .catch(() => live && setRows((current) => current ?? []));
    return () => {
      live = false;
    };
  }, [account, model, id, generation]);

  const send = async () => {
    if (!account || !text.trim()) return;
    setBusy(true);
    try {
      await postNote(account, model, id, text.trim(), kind === 'note');
      setText('');
      await load(0);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t('records.activity')}>
      <View style={styles.compose}>
        <Segmented
          options={[
            { value: 'note', label: t('records.note') },
            { value: 'message', label: t('records.message') },
          ]}
          value={kind}
          onChange={setKind}
          testID="chatter-kind"
        />
        <TextField label={kind === 'note' ? t('records.noteLabel') : t('records.messageLabel')} value={text} onChangeText={setText} multiline testID="chatter-input" />
        <Button kind="secondary" label={t('records.post')} busy={busy} disabled={!text.trim()} onPress={() => void send()} testID="chatter-post" />
      </View>
      {(rows ?? []).map((row) => {
        const body = plainOfHtml(row.body || '');
        const at = parseServerDate(row.date);
        const who = row.author_id ? row.author_id[1] : '';
        if (!body && !row.subtype_id) return null;
        return (
          <View key={row.id} style={styles.message} testID={`chatter-message-${row.id}`}>
            <Text variant="footnote" tone="inkSoft">
              {[who, at ? date(at) : '', row.subtype_id ? row.subtype_id[1] : ''].filter(Boolean).join(' · ')}
            </Text>
            {body ? <Text variant="callout">{body}</Text> : null}
          </View>
        );
      })}
      {rows?.length && more ? <Button kind="plain" label={t('records.older')} onPress={() => void load(rows.length)} testID="chatter-older" /> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  compose: { padding: space.lg, gap: space.sm },
  message: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },
});
