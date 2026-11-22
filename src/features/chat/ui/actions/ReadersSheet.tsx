import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { space, useTheme } from '../../../../theme';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { readersOfMessage, type Readers, type Result } from '../../messageActions';
import type { Message } from '../../types';
import { failureText } from './failure';

export function ReadersSheet({ message, onClose }: { message: Message; onClose: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [result, setResult] = useState<Result<Readers> | null>(null);
  useEffect(() => {
    let live = true;
    void readersOfMessage(message.channelId, message.id).then((next) => live && setResult(next));
    return () => {
      live = false;
    };
  }, [message.channelId, message.id]);
  return (
    <Sheet title={t('readers.title')} onClose={onClose} testID="readers-sheet">
      {!result ? <ActivityIndicator color={colors.primary} style={styles.pad} /> : null}
      {result && !result.ok ? (
        <Text variant="callout" tone="danger">
          {failureText(t, result)}
        </Text>
      ) : null}
      {result?.ok ? (
        <>
          <Text variant="label" tone="inkSoft">
            {t('readers.read', { count: result.value.read, total: result.value.total })}
          </Text>
          {result.value.readers.map((person) => (
            <View key={person.id} style={styles.row}>
              <Text variant="callout">{person.name}</Text>
            </View>
          ))}
          {result.value.notYet.length ? (
            <Text variant="label" tone="inkSoft" style={styles.gap}>
              {t('readers.notYet', { count: result.value.notYet.length })}
            </Text>
          ) : null}
          {result.value.notYet.map((person) => (
            <View key={person.id} style={styles.row}>
              <Text variant="callout" tone="inkSoft">
                {person.name}
              </Text>
            </View>
          ))}
          {result.value.hidden ? (
            <Text variant="footnote" tone="inkSoft">
              {t('readers.more', { count: result.value.hidden })}
            </Text>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.xl },
  row: { minHeight: 40, justifyContent: 'center' },
  gap: { marginTop: space.md },
});
