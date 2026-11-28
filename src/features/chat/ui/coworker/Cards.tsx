import { memo, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../../ui/Pressable';
import { radius, space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Text } from '../../../../ui/Text';
import { DecisionCard } from '../../../discovery/DecisionCard';
import { Markdown } from '../../../discovery/Markdown';
import { agentCardsFor, createCardStore, decideWardmote, recordCards, type AgentCard, type CardStore, type RecordCard, type Wardmote } from '../../coworker';
import { faceSize } from '../MessageBubble';
import { TicketAskCard, TicketCard } from './Tickets';
import { failureText } from '../actions/failure';
import { touchTarget } from '../../../../ui/touch';

function useCardStore<K, V>(load: (keys: K[]) => Promise<Map<K, V> | null>): CardStore<K, V> {
  const store = useMemo(() => createCardStore<K, V>(load), [load]);
  useEffect(() => () => store.dispose(), [store]);
  return store;
}

function useCardVersion<K, V>(store: CardStore<K, V> | null, keys: readonly K[]): number {
  const subscribe = useCallback((listener: () => void) => (store ? store.subscribe(keys, listener) : () => {}), [store, keys]);
  return useSyncExternalStore(subscribe, () => (store ? store.version(keys) : 0));
}

export function useAgentCards(channelId: number) {
  const load = useCallback(async (ids: number[]) => {
    const result = await agentCardsFor(channelId, ids);
    return result.ok ? result.value : null;
  }, [channelId]);
  return useCardStore<number, AgentCard>(load);
}

export function useRecordCards() {
  const load = useCallback(async (urls: string[]) => {
    const result = await recordCards(urls);
    if (!result.ok) return null;
    const out = new Map<string, RecordCard | null>(urls.map((url) => [url, null]));
    for (const [url, card] of result.value) out.set(url, card);
    return out;
  }, []);
  return useCardStore<string, RecordCard | null>(load);
}

export const AgentSaid = memo(function AgentSaid({ store, messageId, children }: { store: CardStore<number, AgentCard>; messageId: number; children: ReactNode }) {
  const ids = useMemo(() => [messageId], [messageId]);
  useCardVersion(store, ids);
  const said = store.get(messageId)?.said;
  if (!said) return <>{children}</>;
  return (
    <View testID={`agent-said-${messageId}`}>
      <Markdown text={said} />
    </View>
  );
});

export const MessageCards = memo(function MessageCards({
  messageId,
  urls,
  mine,
  indent,
  agents,
  records,
  onOpen,
}: {
  messageId: number;
  urls: readonly string[];
  mine: boolean;
  indent: boolean;
  agents: CardStore<number, AgentCard> | null;
  records: CardStore<string, RecordCard | null> | null;
  onOpen: (card: Pick<RecordCard, 'model' | 'id'>) => void;
}) {
  const ids = useMemo(() => [messageId], [messageId]);
  useCardVersion(agents, ids);
  useCardVersion(records, urls);
  const agentCard = agents?.get(messageId);
  const recordList = records ? urls.map((url) => records.get(url)).filter((card): card is RecordCard => !!card) : [];
  const change = useCallback((next: AgentCard) => agents?.put(messageId, next), [agents, messageId]);
  if (!(agentCard && (agentCard.packets.length || agentCard.wardmote || agentCard.ticket || agentCard.ticketAsk)) && !recordList.length) return null;
  return (
    <View style={[styles.below, mine ? styles.belowMine : styles.belowTheirs, indent && styles.belowIndent]}>
      {agentCard ? <AgentCards card={agentCard} onChange={change} /> : null}
      <RecordCards cards={recordList} onOpen={onOpen} />
    </View>
  );
});

function WardmoteCard({ card, onChange }: { card: Wardmote; onChange: (next: Wardmote) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const result = await decideWardmote(card, approve);
    setBusy(false);
    if (result.ok && result.value) onChange(result.value);
    else if (!result.ok) setError(failureText(t, result));
  };
  return (
    <View style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]} testID={`wardmote-${card.turnId}`}>
      <Text variant="label" tone="inkSoft">
        {t('cards.wardmote', { agent: card.agent })}
      </Text>
      <Text variant="callout" style={styles.bold}>
        {card.title}
      </Text>
      {card.body ? (
        <Text variant="footnote" tone="inkSoft" numberOfLines={6}>
          {card.body}
        </Text>
      ) : null}
      <Text variant="footnote" tone="inkSoft">
        {card.issue ? `${card.issue} · ` : ''}
        {card.status || t(`cards.state.${card.state === 'proposed' ? 'proposed' : card.state === 'away' ? 'away' : card.state === 'stopped' ? 'stopped' : 'other'}`)}
      </Text>
      {error ? (
        <Text variant="footnote" tone="danger">
          {error}
        </Text>
      ) : null}
      {card.canDecide ? (
        <View style={styles.row}>
          <Button label={t('cards.approve')} busy={busy} onPress={() => void decide(true)} style={styles.flex} testID={`wardmote-approve-${card.turnId}`} />
          <Button label={t('cards.refuse')} kind="secondary" disabled={busy} onPress={() => void decide(false)} style={styles.flex} testID={`wardmote-refuse-${card.turnId}`} />
        </View>
      ) : null}
      {card.url ? (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(card.url)} style={styles.link}>
          <Text variant="footnote" tone="link">
            {t('cards.openIssue')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AgentCards({ card, onChange }: { card: AgentCard; onChange: (next: AgentCard) => void }) {
  if (!card.packets.length && !card.wardmote && !card.ticket && !card.ticketAsk) return null;
  return (
    <View style={styles.stack}>
      {card.ticket ? <TicketCard ticket={card.ticket} /> : null}
      {card.ticketAsk ? <TicketAskCard ask={card.ticketAsk} /> : null}
      {card.packets.map((packet) => (
        <DecisionCard key={packet.id} card={packet} onAnswered={(next) => onChange({ ...card, packets: card.packets.map((item) => (item.id === next.id ? next : item)) })} />
      ))}
      {card.wardmote ? <WardmoteCard card={card.wardmote} onChange={(next) => onChange({ ...card, wardmote: next })} /> : null}
    </View>
  );
}

const recordKinds = ['task', 'project', 'programme', 'meeting', 'email', 'recording'] as const;
type RecordKind = (typeof recordKinds)[number] | 'other';

function kindOf(kind: string): RecordKind {
  return recordKinds.find((item) => item === kind) ?? 'other';
}

export function RecordCards({ cards, onOpen }: { cards: RecordCard[]; onOpen: (card: Pick<RecordCard, 'model' | 'id'>) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  if (!cards.length) return null;
  return (
    <View style={styles.stack}>
      {cards.map((card) => (
        <Pressable key={`${card.model}-${card.id}`} accessibilityRole="button" onPress={() => onOpen(card)} style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]} testID={`record-card-${card.model}-${card.id}`}>
          <Text variant="label" tone="inkSoft">
            {t(`cards.kind.${kindOf(card.kind)}`)}
            {card.key ? ` · ${card.key}` : ''}
          </Text>
          <Text variant="callout" style={styles.bold} numberOfLines={2}>
            {card.locked ? t('cards.locked') : card.title}
          </Text>
          {!card.locked && (card.status || card.parent || card.people.length) ? (
            <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
              {[card.status, card.parent, card.people.join(', ')].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  link: { minHeight: touchTarget, justifyContent: 'center' },
  bold: { fontWeight: '600' },
  stack: { gap: space.xs, marginTop: space.xs },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, padding: space.md, gap: 4, maxWidth: 420 },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  below: { paddingHorizontal: space.lg + space.md },
  belowMine: { alignItems: 'flex-end' },
  belowTheirs: { alignItems: 'flex-start' },
  belowIndent: { paddingLeft: space.lg + space.sm * 2 + faceSize + space.md },
});
