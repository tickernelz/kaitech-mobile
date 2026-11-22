import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { intlLocale } from '../../../../i18n/language';
import { space, useTheme } from '../../../../theme';
import { Sheet, SheetRow } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { bodyPreview } from '../../markdown';
import type { Result } from '../../messageActions';
import { cancelScheduled, scheduledMessages, sendScheduledNow, takeBackScheduled, type Scheduled, type TakenBack } from '../../threadActions';
import { failureText } from '../actions/failure';

export function ScheduledSheet({ channelId, onClose, onTakeBack, onNotice }: { channelId: number; onClose: () => void; onTakeBack: (taken: TakenBack) => void; onNotice: (text: string) => void }) {
  const { t, i18n } = useTranslation('chat');
  const { colors } = useTheme();
  const when = useMemo(() => new Intl.DateTimeFormat(intlLocale(i18n.language === 'id' ? 'id' : 'en'), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [i18n.language]);
  const [result, setResult] = useState<Result<Scheduled[]> | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => void scheduledMessages(channelId).then(setResult), [channelId]);
  useEffect(load, [load]);
  const act = async (work: () => Promise<Result<unknown>>, done: string) => {
    setBusy(true);
    setError(null);
    const next = await work();
    setBusy(false);
    if (!next.ok) {
      setError(failureText(t, next));
      return;
    }
    setOpen(null);
    onNotice(done);
    load();
  };
  const takeBack = async (id: number) => {
    setBusy(true);
    setError(null);
    const next = await takeBackScheduled(id);
    setBusy(false);
    if (next.ok) onTakeBack(next.value);
    else setError(failureText(t, next));
  };
  return (
    <Sheet title={t('scheduled.title')} onClose={onClose} testID="scheduled-sheet">
      {!result ? <ActivityIndicator color={colors.primary} style={styles.pad} /> : null}
      {result && !result.ok ? (
        <Text variant="callout" tone="danger">
          {failureText(t, result)}
        </Text>
      ) : null}
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite" testID="scheduled-error">
          {error}
        </Text>
      ) : null}
      {result?.ok && !result.value.length ? (
        <Text variant="callout" tone="inkSoft" style={styles.pad} testID="scheduled-none">
          {t('scheduled.none')}
        </Text>
      ) : null}
      {result?.ok
        ? result.value.map((item) => [
            <SheetRow
              key={item.id}
              icon="clock"
              label={bodyPreview(item.body) || t('list.files', { count: item.files })}
              detail={when.format(item.date)}
              selected={open === item.id}
              onPress={() => setOpen(open === item.id ? null : item.id)}
              testID={`scheduled-${item.id}`}
            />,
            open === item.id ? (
              <SheetRow key={`${item.id}-now`} icon="send" label={t('scheduled.sendNow')} disabled={busy} onPress={() => void act(() => sendScheduledNow(item.id), t('scheduled.sent'))} testID="scheduled-send-now" />
            ) : null,
            open === item.id ? <SheetRow key={`${item.id}-edit`} icon="edit" label={t('scheduled.edit')} disabled={busy} onPress={() => void takeBack(item.id)} testID="scheduled-edit" /> : null,
            open === item.id ? (
              <SheetRow key={`${item.id}-delete`} icon="trash" danger label={t('scheduled.cancel')} disabled={busy} onPress={() => void act(() => cancelScheduled(item.id), t('scheduled.cancelled'))} testID="scheduled-delete" />
            ) : null,
          ])
        : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
});
