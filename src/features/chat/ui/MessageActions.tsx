import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { radius, space, useTheme } from '../../../theme';
import { Icon, type IconName } from '../../../ui/icons';
import { Sheet, SheetItem } from '../../../ui/Sheet';
import { Text } from '../../../ui/Text';
import type { Message } from '../types';

const quick = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F64F}', '\u2705'];

export type MessageAction = 'reply' | 'copy' | 'sticker' | 'forward' | 'edit' | 'delete' | 'thread' | 'pin' | 'star' | 'unread' | 'link' | 'translate' | 'task' | 'activity' | 'meeting' | 'reactions' | 'readers' | 'emoji';

export type ActionOptions = Partial<Record<MessageAction, boolean>>;

export function MessageActions({
  message,
  mine,
  readers,
  options,
  onClose,
  onReact,
  onAction,
}: {
  message: Message | null;
  mine: boolean;
  readers: number;
  options: ActionOptions;
  onClose: () => void;
  onReact: (message: Message, content: string) => void;
  onAction: (action: MessageAction, message: Message) => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [more, setMore] = useState(false);
  if (!message) return null;
  const close = () => {
    setMore(false);
    onClose();
  };
  const act = (action: MessageAction) => () => {
    setMore(false);
    onAction(action, message);
  };
  const row = (action: MessageAction, icon: IconName, label: string, danger = false) =>
    options[action] ? <SheetItem key={action} icon={icon} label={label} onPress={act(action)} danger={danger} testID={`action-${action}`} /> : null;
  const extra = [
    row('thread', 'thread', t('actions.thread')),
    row('pin', 'pin', message.pinnedAt ? t('actions.unpin') : t('actions.pin')),
    row('star', 'star', message.starred ? t('actions.unstar') : t('actions.star')),
    row('unread', 'unread', t('actions.unread')),
    row('link', 'link', t('actions.link')),
    row('translate', 'globe', message.translated ? t('actions.original') : t('actions.translate')),
    row('task', 'task', t('actions.task')),
    row('activity', 'clock', t('actions.activity')),
    row('meeting', 'calendar', t('actions.meeting')),
    row('reactions', 'people', t('actions.reactions')),
  ].filter(Boolean);
  const primary = [
    row('reply', 'reply', t('actions.reply')),
    row('copy', 'copy', t('actions.copy')),
    row('sticker', 'favorite', t('actions.favoriteSticker')),
    row('forward', 'forwardMessage', t('actions.forward')),
    row('edit', 'edit', t('actions.edit')),
    row('delete', 'trash', t('actions.delete'), true),
  ];
  return (
    <Sheet onClose={close} testID="message-actions">
      {options.emoji !== false ? (
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
                  close();
                  onReact(message, emoji);
                }}
                style={[styles.emoji, mineReaction && { backgroundColor: colors.select }]}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel={t('actions.moreEmoji')} onPress={act('emoji')} style={styles.emoji} testID="action-emoji">
            <Icon name="emoji" color={colors.inkSoft} />
          </Pressable>
        </View>
      ) : null}
      {primary}
      {extra.length ? (
        more ? (
          extra
        ) : (
          <SheetItem icon="more" label={t('actions.more')} onPress={() => setMore(true)} testID="action-more" />
        )
      ) : null}
      {mine ? (
        <SheetItem
          icon="eye"
          label={readers ? t('actions.readBy', { count: readers }) : t('actions.notRead')}
          onPress={options.readers ? act('readers') : undefined}
          testID="action-readers"
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reactions: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: radius.pill, padding: space.xs, marginBottom: space.sm },
  emoji: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 26, lineHeight: 32 },
});
