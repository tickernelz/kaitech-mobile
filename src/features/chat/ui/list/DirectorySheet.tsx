import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { Pressable } from '../../../../ui/Pressable';
import type { DirectoryPerson } from '../../directory';
import { loadDirectory, openChatWith } from '../../newConversation';
import { failureText } from '../actions/failure';
import { Avatar } from '../Avatar';

export function DirectorySheet({ onClose, onOpen }: { onClose: () => void; onOpen: (id: number) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [people, setPeople] = useState<DirectoryPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void loadDirectory().then((result) => {
      if (!live) return;
      if (result.ok) {
        setPeople(result.value);
        setError(null);
      } else setError(failureText(t, result));
    });
    return () => {
      live = false;
    };
  }, [attempt, t]);
  const open = async (person: DirectoryPerson) => {
    if (opening) return;
    setOpening(person.partnerId);
    const result = await openChatWith(person.partnerId);
    setOpening(null);
    if (result.ok) onOpen(result.value);
    else setError(failureText(t, result));
  };
  return (
    <Sheet title={t('directory.title')} detail={t('directory.detail')} onClose={onClose} testID="directory-sheet">
      {error ? (
        <View style={styles.state}>
          <Text variant="callout" tone="dangerInk" accessibilityRole="alert" testID="directory-error">
            {error}
          </Text>
          <Button kind="secondary" label={t('directory.retry')} onPress={() => setAttempt((value) => value + 1)} testID="directory-retry" />
        </View>
      ) : null}
      {!people && !error ? <ActivityIndicator color={colors.primary} style={styles.state} accessibilityLabel={t('directory.loading')} /> : null}
      {people && !people.length ? (
        <Text variant="callout" tone="inkSoft" style={styles.state} testID="directory-empty">
          {t('directory.empty')}
        </Text>
      ) : null}
      {people?.map((person) => (
        <Pressable
          key={`${person.partnerId}-${person.programme}`}
          accessibilityRole="button"
          accessibilityState={{ busy: opening === person.partnerId }}
          disabled={opening !== null}
          onPress={() => void open(person)}
          android_ripple={{ color: `${colors.ink}1A`, foreground: true }}
          style={styles.row}
          testID={`directory-${person.partnerId}`}>
          <Avatar name={person.name} seed={person.partnerId} partnerId={person.partnerId} size={40} />
          <View style={styles.text}>
            <Text variant="headline" numberOfLines={1}>
              {person.name}
            </Text>
            <Text variant="callout" tone="inkSoft" numberOfLines={1}>
              {person.role === 'Coworker' ? t('directory.coworker') : [t(`directory.role.${person.role}`), person.programme].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {opening === person.partnerId ? <ActivityIndicator color={colors.primary} /> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  state: { paddingVertical: space.lg, gap: space.md },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  text: { flex: 1, gap: 2 },
});
