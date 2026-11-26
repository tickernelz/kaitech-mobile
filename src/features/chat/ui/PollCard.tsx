import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../theme';
import { confirm, notify } from '../../../ui/dialog';
import { Icon } from '../../../ui/icons';
import { Pressable } from '../../../ui/Pressable';
import { Text } from '../../../ui/Text';
import { failureText } from './actions/failure';
import { useChat } from '../chat';
import { chosenBy, closePoll, nextChoice, shareOf, vote } from '../polls';
import type { Message, Poll } from '../types';
import { VotesSheet } from './VotesSheet';

export const pollWidth = 264;

export const PollCard = memo(function PollCard({ message, poll, mine, pending = false }: { message: Pick<Message, 'id' | 'channelId'>; poll: Poll; mine: boolean; pending?: boolean }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const partnerId = useChat((state) => state.partnerId);
  const [votes, setVotes] = useState(false);
  const chosen = chosenBy(poll, partnerId);
  const locked = poll.closed || pending;
  const pick = async (optionId: number) => {
    const result = await vote(message, nextChoice(poll, chosen, optionId));
    if (!result.ok) notify(result.reason === 'closed' ? t('poll.closedNow') : failureText(t, result));
  };
  const close = async () => {
    const go = await confirm({ title: t('poll.closeTitle'), body: t('poll.closeBody'), confirm: t('poll.close'), cancel: t('poll.keepOpen'), icon: 'poll', testID: 'poll-close-dialog' });
    if (!go) return;
    const result = await closePoll(message);
    if (!result.ok) notify(failureText(t, result));
  };
  const total = poll.votersCount;
  return (
    <View style={styles.card} testID={`poll-${message.id}`}>
      <Text variant="headline" style={{ color: colors.ink }}>
        {poll.question}
      </Text>
      <View style={styles.kind}>
        <Icon name={poll.closed ? 'lock' : 'poll'} size={16} color={colors.inkSoft} />
        <Text variant="footnote" tone="inkSoft">
          {poll.closed ? t('poll.closed') : poll.multiple ? t('poll.pickMany') : t('poll.pickOne')}
        </Text>
      </View>
      <View accessibilityRole={poll.multiple ? undefined : 'radiogroup'} style={styles.options}>
        {poll.options.map((option, index) => {
          const selected = chosen.includes(option.id);
          const share = shareOf(option.votes, poll);
          const percent = Math.round(share * 100);
          return (
            <Pressable
              key={option.id}
              accessibilityRole={poll.multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: selected, disabled: locked }}
              accessibilityLabel={t('poll.optionState', { label: option.label, count: option.votes, percent })}
              disabled={locked}
              onPress={() => void pick(option.id)}
              style={styles.option}
              testID={`poll-${message.id}-option-${index}`}>
              <View style={styles.optionRow}>
                <View
                  style={[
                    poll.multiple ? styles.box : styles.radio,
                    { borderColor: selected ? colors.primary : colors.edge, backgroundColor: selected ? colors.primary : 'transparent' },
                  ]}>
                  {selected ? <Icon name="check" size={14} color={colors.onPrimary} /> : null}
                </View>
                <Text variant="callout" style={[styles.label, { color: colors.ink }]}>
                  {option.label}
                </Text>
                <Text variant="footnote" tone="inkSoft" style={styles.count}>
                  {option.votes}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.line }]}>
                <View style={[styles.fill, { width: `${percent}%`, backgroundColor: selected ? colors.primary : colors.inkFaint }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        <Pressable accessibilityRole="button" onPress={() => setVotes(true)} disabled={pending} hitSlop={8} style={styles.action} testID={`poll-${message.id}-votes`}>
          <Text variant="footnote" tone="link">
            {total ? t('poll.viewVotes', { count: total }) : t('poll.noVotes')}
          </Text>
        </Pressable>
        {mine && !poll.closed && !pending ? (
          <Pressable accessibilityRole="button" onPress={() => void close()} hitSlop={8} style={styles.action} testID={`poll-${message.id}-close`}>
            <Text variant="footnote" tone="link">
              {t('poll.close')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {votes ? <VotesSheet poll={poll} onClose={() => setVotes(false)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: pollWidth, gap: space.sm, paddingVertical: space.xs },
  kind: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  options: { gap: space.sm },
  option: { gap: space.xs, minHeight: 44, justifyContent: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  box: { width: 22, height: 22, borderRadius: radius.sm / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
  count: { minWidth: 20, textAlign: 'right' },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden', marginLeft: 30 },
  fill: { height: 4, borderRadius: radius.pill },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  action: { minHeight: 32, justifyContent: 'center' },
});
