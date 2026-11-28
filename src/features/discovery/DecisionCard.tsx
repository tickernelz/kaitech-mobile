import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, stroke, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { answer, type Card } from './api';
import { Icon } from '../../ui/icons';
import { Chip, useErrorText } from './ui';

export function isOpen(card: Card): boolean {
  return !card.settled && !card.withdrawn;
}

export function awaitsYou(card: Card): boolean {
  return isOpen(card) && card.instruction?.state === 'awaiting' && card.instruction.yours !== false;
}

export function DecisionCard({ card, onAnswered }: { card: Card; onAnswered?: (next: Card) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState<'agree' | 'contradict' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const open = isOpen(card);
  const waiting = awaitsYou(card);

  const decide = async (agree: boolean) => {
    if (!active || !card.instruction) return;
    setBusy(agree ? 'agree' : 'contradict');
    setError(null);
    try {
      const next = await answer(active, card.instruction.id, agree);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAnswered?.(next);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      testID={`card-${card.id}`}
      accessibilityLabel={card.title}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: open ? colors.warnInk : colors.line }]}>
      <View style={[styles.band, { backgroundColor: open ? colors.warnBand : colors.surface2 }]}>
        <Icon name="decision" size={20} color={open ? colors.warnInk : colors.inkSoft} />
        <Text variant="label" style={{ color: open ? colors.warnInk : colors.inkSoft }}>
          {card.settled
            ? t('discovery.card.settled')
            : card.withdrawn
              ? t('discovery.card.withdrawn')
              : waiting
                ? t('discovery.card.confirm')
                : t('discovery.card.needsYou')}
        </Text>
      </View>
      <View style={styles.body}>
        <Text variant="headline" accessibilityRole="header">
          {card.title}
        </Text>
        {card.stage ? (
          <Text variant="footnote" tone="inkFaint">
            {card.stage}
          </Text>
        ) : null}
        {card.why ? <Text tone="inkSoft">{card.why}</Text> : null}
        {card.items.map((item) => (
          <View key={item.id} style={[styles.item, { borderColor: colors.line }]}>
            <Text variant="callout">{item.name}</Text>
            {item.arguments.map((argument) => (
              <Text key={argument.name} variant="footnote" tone="inkSoft">
                {argument.label}: {argument.value}
              </Text>
            ))}
            <View style={styles.chips}>
              {item.outcome === 'accepted' ? <Chip tone="ok" label={t('discovery.card.accepted')} /> : null}
              {item.outcome === 'held' ? <Chip tone="neutral" label={t('discovery.card.held')} /> : null}
              {item.doubtful ? <Chip tone="warn" label={t('discovery.card.doubtful')} /> : null}
            </View>
            {item.doubt ? (
              <Text variant="footnote" tone="warnInk">
                {item.doubt}
              </Text>
            ) : null}
          </View>
        ))}
        {card.instruction?.restatement ? (
          <View style={[styles.restated, { backgroundColor: colors.surface2 }]}>
            <Text variant="label" tone="inkSoft">
              {t('discovery.card.saidBack', { name: card.instruction.said_by })}
            </Text>
            <Text>{card.instruction.restatement}</Text>
          </View>
        ) : null}
        {card.settled && card.decided_by ? (
          <Text variant="footnote" tone="okInk">
            {card.decided_by_you ? t('discovery.card.decidedByYou') : t('discovery.card.decidedBy', { name: card.decided_by })}
          </Text>
        ) : null}
        {open && !waiting ? (
          <Text variant="footnote" tone="inkSoft">
            {t('discovery.card.replyHint')}
          </Text>
        ) : null}
        {error ? (
          <Text variant="footnote" tone="dangerInk" accessibilityRole="alert">
            {errorText(error)}
          </Text>
        ) : null}
        {waiting ? (
          <View style={styles.actions}>
            <Button
              label={t('discovery.card.agree')}
              busy={busy === 'agree'}
              disabled={busy !== null}
              onPress={() => void decide(true)}
              testID={`card-${card.id}-agree`}
              style={styles.action}
            />
            <Button
              kind="secondary"
              label={t('discovery.card.contradict')}
              busy={busy === 'contradict'}
              disabled={busy !== null}
              onPress={() => void decide(false)}
              testID={`card-${card.id}-contradict`}
              style={styles.action}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  band: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  body: { padding: space.lg, gap: space.sm },
  item: { borderTopWidth: stroke.hairline, paddingTop: space.sm, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  restated: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  action: { flexGrow: 1, flexBasis: 140 },
});
