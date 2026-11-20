import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { plainText } from '../html';
import type { Message } from '../types';
import { Icon, type IconName } from './icons';

const quick = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F64F}', '\u2705'];

export function MessageActions({
  message,
  mine,
  readers,
  canThread,
  onClose,
  onReply,
  onReact,
  onCopy,
  onThread,
}: {
  message: Message | null;
  mine: boolean;
  readers: number;
  canThread: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onReact: (message: Message, content: string) => void;
  onCopy: (message: Message) => void;
  onThread: (message: Message) => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!message) return null;
  const run = (action: (target: Message) => void) => () => {
    onClose();
    action(message);
  };
  const items: { icon: IconName; label: string; onPress: () => void; testID: string }[] = [
    { icon: 'reply', label: t('actions.reply'), onPress: run(onReply), testID: 'action-reply' },
    ...(canThread ? [{ icon: 'thread' as const, label: t('actions.thread'), onPress: run(onThread), testID: 'action-thread' }] : []),
    ...(plainText(message.body) ? [{ icon: 'copy' as const, label: t('actions.copy'), onPress: run(onCopy), testID: 'action-copy' }] : []),
  ];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('actions.close')}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => undefined} accessibilityViewIsModal testID="message-actions">
          <View style={[styles.reactions, { backgroundColor: colors.surface2 }]}>
            {quick.map((emoji) => {
              const mineReaction = message.reactions.some((reaction) => reaction.content === emoji && reaction.mine);
              return (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={t('actions.react', { emoji })}
                  accessibilityState={{ selected: mineReaction }}
                  onPress={() => {
                    onClose();
                    onReact(message, emoji);
                  }}
                  style={[styles.emoji, mineReaction && { backgroundColor: colors.select }]}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
          {items.map((item) => (
            <Pressable key={item.testID} accessibilityRole="button" onPress={item.onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface2 }]} testID={item.testID}>
              <Icon name={item.icon} color={colors.ink} />
              <Text variant="body" style={styles.flex}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          {mine ? (
            <View style={styles.item}>
              <Icon name="eye" color={colors.inkSoft} />
              <Text variant="body" tone="inkSoft" style={styles.flex}>
                {readers ? t('actions.readBy', { count: readers }) : t('actions.notRead')}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(17,5,27,0.45)' },
  sheet: { width: '100%', maxWidth: 560, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg, gap: space.xs },
  reactions: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: radius.pill, padding: space.xs, marginBottom: space.sm },
  emoji: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 26, lineHeight: 32 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.sm, borderRadius: radius.md },
});
