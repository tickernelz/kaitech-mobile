import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { space, useTheme } from '../../../../theme';
import { Sheet, SheetRow } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { bodyPreview } from '../../markdown';
import type { Result } from '../../messageActions';
import { cancelScheduled, scheduledMessages, sendScheduledNow, takeBackScheduled, type Scheduled, type TakenBack } from '../../threadActions';
import { useChatFormat } from '../format';
import { failureText } from '../actions/failure';

export function ScheduledSheet({ channelId, onClose, onTakeBack, onNotice }: { channelId: number; onClose: () => void; onTakeBack: (taken: TakenBack) => void; onNotice: (text: string) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { dayLabel, clock } = useChatFormat();
  const [result, setResult] = useState<Result<Scheduled[]> | null>(null);
  const load = useCallback(() => void scheduledMessages(channelId).then(setResult), [channelId]);
  useEffect(load, [load]);
  const after = (done: string) => (next: Result<unknown>) => {
    if (next.ok) {
      onNotice(done);
      load();
    } else onNotice(failureText(t, next));
  };
  const choose = (item: Scheduled) => {
    Alert.alert(bodyPreview(item.body).slice(0, 80) || t('list.files', { count: item.files }), `${dayLabel(item.date)} ${clock(item.date)}`, [
      { text: t('scheduled.sendNow'), onPress: () => void sendScheduledNow(item.id).then(after(t('scheduled.sent'))) },
      {
        text: t('scheduled.edit'),
        onPress: () =>
          void takeBackScheduled(item.id).then((next) => {
            if (next.ok) onTakeBack(next.value);
            else onNotice(failureText(t, next));
          }),
      },
      { text: t('scheduled.cancel'), style: 'destructive', onPress: () => void cancelScheduled(item.id).then(after(t('scheduled.cancelled'))) },
      { text: t('act.cancel'), style: 'cancel' },
    ]);
  };
  return (
    <Sheet title={t('scheduled.title')} onClose={onClose} testID="scheduled-sheet">
      {!result ? <ActivityIndicator color={colors.primary} style={styles.pad} /> : null}
      {result && !result.ok ? (
        <Text variant="callout" tone="danger">
          {failureText(t, result)}
        </Text>
      ) : null}
      {result?.ok && !result.value.length ? (
        <Text variant="callout" tone="inkSoft" style={styles.pad}>
          {t('scheduled.none')}
        </Text>
      ) : null}
      {result?.ok
        ? result.value.map((item) => (
            <SheetRow
              key={item.id}
              icon="clock"
              label={bodyPreview(item.body) || t('list.files', { count: item.files })}
              detail={`${dayLabel(item.date)} ${clock(item.date)}`}
              onPress={() => choose(item)}
              testID={`scheduled-${item.id}`}
            />
          ))
        : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
});
