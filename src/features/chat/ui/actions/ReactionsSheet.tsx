import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { space } from '../../../../theme';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import type { Message } from '../../types';

export function ReactionsSheet({ message, onClose }: { message: Message; onClose: () => void }) {
  const { t } = useTranslation('chat');
  return (
    <Sheet title={t('reactions.title')} onClose={onClose} testID="reactions-sheet">
      {message.reactions.map((reaction) => (
        <View key={reaction.content} style={styles.row}>
          <Text style={styles.emoji}>{reaction.content}</Text>
          <View style={styles.flex}>
            <Text variant="callout">{reaction.people?.length ? reaction.people.join(', ') : t('reactions.count', { count: reaction.count })}</Text>
          </View>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  emoji: { fontSize: 26, lineHeight: 32, width: 40, textAlign: 'center' },
});
