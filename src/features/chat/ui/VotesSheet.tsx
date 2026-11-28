import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { space, stroke, useTheme } from '../../../theme';
import { Sheet } from '../../../ui/Sheet';
import { Text } from '../../../ui/Text';
import { useChat } from '../chat';
import type { Poll } from '../types';
import { Avatar } from './Avatar';

export function VotesSheet({ poll, onClose }: { poll: Poll; onClose: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const partnerId = useChat((state) => state.partnerId);
  return (
    <Sheet title={t('poll.votesTitle')} detail={poll.question} onClose={onClose} testID="poll-votes">
      {poll.options.map((option, index) => (
        <View key={option.id} style={styles.group} testID={`poll-votes-${index}`}>
          <View style={[styles.head, { borderBottomColor: colors.line }]}>
            <Text variant="callout" style={[styles.flex, { color: colors.ink }]}>
              {option.label}
            </Text>
            <Text variant="footnote" tone="inkSoft">
              {t('poll.votes', { count: option.votes })}
            </Text>
          </View>
          {option.voters.length ? (
            option.voters.map((voter) => {
              const name = voter.id === partnerId ? t('thread.you') : voter.name || t('poll.someone');
              return (
                <View key={voter.id} style={styles.person}>
                  <Avatar name={name} seed={voter.id} size={32} partnerId={voter.id} />
                  <Text variant="callout" style={{ color: colors.ink }} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text variant="footnote" tone="inkFaint" style={styles.none}>
              {t('poll.nobody')}
            </Text>
          )}
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { paddingVertical: space.sm, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.xs, borderBottomWidth: stroke.hairline },
  flex: { flex: 1 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  none: { paddingVertical: space.xs },
});
