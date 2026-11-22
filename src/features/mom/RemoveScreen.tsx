import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { StateView, useErrorText } from '../discovery/ui';
import { meetingRecordings, removalPreview, removeRecording } from './records';

export function RemoveScreen({ recording, meeting }: { recording: number; meeting: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const { active } = useSession();
  const board = useResource(`mom.recordings.${meeting}`, (account) => meetingRecordings(account, meeting));
  const preview = useResource(`mom.removal.${recording}`, (account) => removalPreview(account, recording), 0);
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const card = board.data?.recordings.find((one) => one.id === recording);
  const name = card?.name ?? '';
  const ready = !!preview.data && !preview.data.held && !!name && title.trim() === name.trim() && !!password && !busy;

  const remove = async () => {
    if (!active || !ready) return;
    setBusy(true);
    setProblem('');
    try {
      const outcome = await removeRecording(active, recording, title, password);
      if (outcome.ok) {
        invalidate(`${active.id}:mom.`);
        router.back();
        return;
      }
      setProblem(outcome.message ?? t('errors.unknown'));
      setPassword('');
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const loading = !preview.data || !board.data;
  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentStyle={styles.body}
      testID="mom-remove"
      footer={
        <>
          {problem ? (
            <Text variant="callout" tone="dangerInk" accessibilityRole="alert" testID="mom-remove-problem">
              {problem}
            </Text>
          ) : null}
          <Button label={t('mom.remove.confirm')} kind="danger" onPress={() => void remove()} disabled={!ready} busy={busy} testID="mom-remove-confirm" />
          <Button label={t('mom.remove.keep')} kind="secondary" onPress={() => router.back()} testID="mom-remove-keep" />
        </>
      }>
      <Header title={t('mom.remove.title')} />
      {loading ? (
        <StateView loading={!preview.error && !board.error} error={preview.error ?? board.error} onRetry={() => void (preview.error ? preview.refresh() : board.refresh())} testID="mom-remove" />
      ) : card ? (
        <View style={styles.body}>
          <Text variant="headline" selectable testID="mom-remove-name">
            {name}
          </Text>
          <Text>{t('mom.remove.warning')}</Text>
          {preview.data!.withdrawn.length ? (
            <View style={[styles.box, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              <Text variant="callout" style={styles.strong}>
                {t('mom.remove.withdrawn')}
              </Text>
              {preview.data!.withdrawn.map((line) => (
                <Text key={line} variant="callout">
                  {`• ${line}`}
                </Text>
              ))}
            </View>
          ) : null}
          {preview.data!.held ? (
            <View style={[styles.box, { borderColor: colors.line, backgroundColor: colors.surface2 }]} accessibilityRole="alert">
              <Text variant="callout">{preview.data!.held}</Text>
            </View>
          ) : null}
          <TextField label={t('mom.remove.typeTitle')} hint={name} value={title} onChangeText={setTitle} autoCorrect={false} autoCapitalize="none" testID="mom-remove-title" />
          <TextField
            label={t('mom.remove.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={() => void remove()}
            testID="mom-remove-password"
          />
        </View>
      ) : (
        <StateView empty={{ title: t('mom.remove.gone'), icon: 'trash' }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  strong: { fontWeight: '600' },
  box: { gap: space.xs, padding: space.lg, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
