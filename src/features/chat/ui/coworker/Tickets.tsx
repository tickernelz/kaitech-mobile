import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import { Button } from '../../../../ui/Button';
import { Icon, type IconName } from '../../../../ui/icons';
import { Pressable } from '../../../../ui/Pressable';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { touchTarget } from '../../../../ui/touch';
import { useChat } from '../../chat';
import type { TicketAsk } from '../../coworker';
import {
  answerQuestion,
  followTicket,
  lastSteps,
  onTicketNotice,
  readTicket,
  stopTicket,
  ticketList,
  type Option,
  type Question,
  type Scope,
  type Ticket,
  type TicketRow,
  type TicketState,
} from '../../tickets';
import { failureText } from '../actions/failure';

const glyphs: Record<TicketState, IconName> = { draft: 'clock', progress: 'play', blocked: 'pause', done: 'check', cancelled: 'stop' };

function useStateColors(state: TicketState) {
  const { colors } = useTheme();
  if (state === 'blocked') return { ink: colors.warnInk, band: colors.warnBand };
  if (state === 'done') return { ink: colors.okInk, band: colors.okBand };
  if (state === 'progress') return { ink: colors.infoInk, band: colors.infoBand };
  return { ink: colors.inkSoft, band: colors.surface2 };
}

export function StateChip({ state }: { state: TicketState }) {
  const { t } = useTranslation('chat');
  const { ink, band } = useStateColors(state);
  return (
    <View style={[styles.chip, { backgroundColor: band, borderColor: ink }]} testID={`ticket-state-${state}`}>
      <Icon name={glyphs[state]} size={14} color={ink} />
      <Text variant="label" style={{ color: ink }}>
        {t(`tickets.state.${state}`)}
      </Text>
    </View>
  );
}

function useLiveTicket(initial: Ticket) {
  const accountId = useChat((state) => state.accountId);
  const [held, setHeld] = useState<{ from: Ticket; ticket: Ticket; gone: boolean }>({ from: initial, ticket: initial, gone: false });
  if (held.from !== initial) setHeld({ from: initial, ticket: initial, gone: false });
  const ticket = held.from === initial ? held.ticket : initial;
  const gone = held.from === initial && held.gone;
  const setTicket = useCallback((next: Ticket) => setHeld((current) => ({ ...current, ticket: next })), []);
  const markGone = useCallback(() => setHeld((current) => ({ ...current, gone: true })), []);
  const refresh = useCallback(async () => {
    const reading = await readTicket(accountId, initial.id);
    if (reading && 'gone' in reading) markGone();
    else if (reading) setTicket(reading.ticket);
  }, [accountId, initial.id, setTicket, markGone]);
  useEffect(() => onTicketNotice((notice) => (notice.ticketId === initial.id ? void refresh() : undefined)), [initial.id, refresh]);
  return { ticket, gone, setTicket, markGone };
}

export function TicketCard({ ticket: initial }: { ticket: Ticket }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { ticket, gone, setTicket, markGone } = useLiveTicket(initial);
  const [open, setOpen] = useState(false);
  const steps = lastSteps(ticket, 1);
  if (gone) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${ticket.number}, ${ticket.name}, ${t(`tickets.state.${ticket.state}`)}`}
        onPress={() => setOpen(true)}
        style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]}
        testID={`ticket-card-${ticket.id}`}>
        <View style={styles.head}>
          <Text variant="label" tone="inkSoft">
            {ticket.number}
          </Text>
          <StateChip state={ticket.state} />
        </View>
        <Text variant="callout" style={styles.bold} numberOfLines={2}>
          {ticket.name}
        </Text>
        <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
          {t('tickets.askedBy', { requester: ticket.requester, agent: ticket.agent })}
        </Text>
        {steps.map((step) => (
          <Text key={step.id} variant="footnote" numberOfLines={2}>
            {`${step.actor}: ${step.body}`}
          </Text>
        ))}
        {ticket.state === 'progress' && ticket.live ? (
          <Text variant="footnote" tone="infoInk" accessibilityLiveRegion="polite">
            {t('tickets.working')}
          </Text>
        ) : null}
      </Pressable>
      {open ? <TicketDetail ticket={ticket} onChange={setTicket} onGone={markGone} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function TicketAskCard({ ask }: { ask: TicketAsk }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const online = useChat((state) => state.online);
  const [answered, setAnswered] = useState<Question | null>(null);
  const { ticket, gone, setTicket } = useLiveTicket(ask.ticket);
  const [sheet, setSheet] = useState(false);
  const fresh = ticket.questions.find((item) => item.id === ask.question.id);
  const question: Question = answered ?? (fresh ? { ...fresh, canAnswer: ticket.canDecide && fresh.state === 'open' } : ask.question);
  const deciders = ticket.answerers.join(', ') || ticket.requester;
  const chosen = question.options.find((option) => option.id === question.answeredOption);
  if (gone) return null;
  return (
    <View style={[styles.card, styles.ask, { borderColor: colors.warnInk, backgroundColor: colors.warnBand }]} testID={`ticket-ask-${question.id}`}>
      <Text variant="label" tone="warnInk">
        {t('tickets.waitsFor', { number: ticket.number, people: deciders })}
      </Text>
      <Text variant="callout" style={styles.bold}>
        {question.question}
      </Text>
      <Text variant="footnote">
        <Text variant="footnote" style={styles.bold}>
          {t('tickets.recommended')}:{' '}
        </Text>
        {question.recommendation}
      </Text>
      {question.state !== 'open' ? (
        <Text variant="footnote" tone="inkSoft" testID={`ticket-ask-done-${question.id}`}>
          {chosen ? t('tickets.chose', { person: question.answeredBy, option: chosen.label }) : question.answeredBy ? t('tickets.answeredInWords', { person: question.answeredBy }) : t('tickets.noLongerWaiting')}
        </Text>
      ) : question.canAnswer ? (
        <Button label={t('tickets.answer')} onPress={() => setSheet(true)} testID={`ticket-answer-${question.id}`} />
      ) : (
        <Text variant="footnote" tone="inkSoft">
          {t('tickets.only', { people: deciders })}
        </Text>
      )}
      {sheet ? (
        <AnswerSheet
          question={question}
          online={online}
          onClose={() => setSheet(false)}
          onAnswered={(next, option) => {
            if (next) setTicket(next);
            setAnswered({ ...question, state: 'answered', answeredOption: option.id, answeredBy: t('tickets.you'), canAnswer: false });
            setSheet(false);
          }}
        />
      ) : null}
    </View>
  );
}

function AnswerSheet({ question, online, onClose, onAnswered }: { question: Question; online: boolean; onClose: () => void; onAnswered: (next: Ticket | null, option: Option) => void }) {
  const { t } = useTranslation('chat');
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choose = async (option: Option) => {
    setBusy(option.id);
    setError(null);
    const result = await answerQuestion(question.id, option.id);
    setBusy(null);
    if (result.ok) onAnswered(result.value, option);
    else setError(failureText(t, result));
  };
  return (
    <Sheet title={question.question} detail={`${t('tickets.recommended')}: ${question.recommendation}`} onClose={onClose} testID="ticket-answer-sheet">
      <View style={styles.options}>
        {question.options.map((option) => (
          <Button
            key={option.id}
            label={option.recommended ? `${option.label} · ${t('tickets.recommended')}` : option.label}
            kind={option.recommended ? 'primary' : 'secondary'}
            busy={busy === option.id}
            disabled={!online || busy !== null}
            onPress={() => void choose(option)}
            testID={`ticket-option-${option.id}`}
          />
        ))}
        {!online ? (
          <Text variant="footnote" tone="inkSoft" testID="ticket-offline">
            {t('tickets.offline')}
          </Text>
        ) : null}
        {error ? (
          <Text variant="footnote" tone="danger">
            {error}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

export function TicketDetail({ ticket, onChange, onGone, onClose }: { ticket: Ticket; onChange: (next: Ticket) => void; onGone: () => void; onClose: () => void }) {
  const { t } = useTranslation('chat');
  const online = useChat((state) => state.online);
  const accountId = useChat((state) => state.accountId);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void readTicket(accountId, ticket.id).then((reading) => {
      if (reading && 'gone' in reading) onGone();
      else if (reading) onChange(reading.ticket);
    });
  }, [accountId, ticket.id, onChange, onGone]);
  const act = async (work: () => ReturnType<typeof stopTicket>) => {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    setConfirming(false);
    if (result.ok && result.value) onChange(result.value);
    else if (!result.ok) setError(failureText(t, result));
  };
  return (
    <Sheet title={`${ticket.number} · ${ticket.name}`} onClose={onClose} testID={`ticket-detail-${ticket.id}`}>
      <View style={styles.detail}>
        <View style={styles.head}>
          <StateChip state={ticket.state} />
          <Text variant="footnote" tone="inkSoft" style={styles.flex}>
            {t('tickets.askedBy', { requester: ticket.requester, agent: ticket.agent })}
          </Text>
        </View>
        {ticket.programme ? (
          <Text variant="footnote" tone="inkSoft">
            {t('tickets.programme', { name: ticket.programme })}
          </Text>
        ) : null}
        {ticket.summary ? <Text variant="callout">{ticket.summary}</Text> : null}
        {ticket.result ? <Text variant="callout" style={styles.bold}>{ticket.result}</Text> : null}
        <Text variant="label" tone="inkSoft">
          {t('tickets.timeline')}
        </Text>
        {ticket.checkpoints.map((step) => (
          <View key={step.id} style={styles.step} testID={`ticket-step-${step.id}`}>
            <Text variant="footnote" tone="inkSoft">
              {step.at.slice(11, 16)}
            </Text>
            <Text variant="footnote" style={styles.flex}>
              <Text variant="footnote" style={styles.bold}>
                {step.actor}{' '}
              </Text>
              {step.body}
            </Text>
          </View>
        ))}
        {ticket.linked.length ? (
          <Text variant="footnote" tone="inkSoft">
            {t('tickets.linked', { list: ticket.linked.map((item) => (item.name ? `${item.number} ${item.name}` : item.number)).join(', ') })}
          </Text>
        ) : null}
        {error ? (
          <Text variant="footnote" tone="danger">
            {error}
          </Text>
        ) : null}
        {!online && (ticket.canStop || ticket.canFollow) ? (
          <Text variant="footnote" tone="inkSoft">
            {t('tickets.offline')}
          </Text>
        ) : null}
        {ticket.canFollow ? (
          <Button
            label={ticket.following ? t('tickets.unfollow') : t('tickets.follow')}
            kind="secondary"
            disabled={!online || busy}
            onPress={() => void act(() => followTicket(ticket.id, !ticket.following))}
            testID="ticket-follow"
          />
        ) : null}
        {ticket.canStop ? (
          confirming ? (
            <View style={styles.options}>
              <Text variant="footnote">{t('tickets.stopConfirm')}</Text>
              <Button label={t('tickets.keep')} kind="secondary" onPress={() => setConfirming(false)} testID="ticket-stop-keep" />
              <Button label={t('tickets.stop')} kind="danger" busy={busy} disabled={!online} onPress={() => void act(() => stopTicket(ticket.id))} testID="ticket-stop-confirm" />
            </View>
          ) : (
            <Button label={t('tickets.stop')} kind="danger" disabled={!online} onPress={() => setConfirming(true)} testID="ticket-stop" />
          )
        ) : null}
      </View>
    </Sheet>
  );
}

const scopes: Exclude<Scope, 'all'>[] = ['waiting', 'mine', 'threads'];

export function TicketsSheet({ onClose, onOpenThread }: { onClose: () => void; onOpenThread: (channelId: number, messageId: number) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [scope, setScope] = useState<Exclude<Scope, 'all'>>('waiting');
  const [rows, setRows] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const select = (name: Exclude<Scope, 'all'>) => {
    if (name === scope) return;
    setScope(name);
    setRows(null);
    setError(null);
  };
  useEffect(() => {
    let live = true;
    void ticketList(scope).then((result) => {
      if (!live) return;
      if (result.ok) setRows(result.value.rows);
      else setError(failureText(t, result));
    });
    return () => {
      live = false;
    };
  }, [scope, t]);
  return (
    <Sheet title={t('tickets.title')} onClose={onClose} testID="tickets-sheet">
      <View style={styles.scopes} accessibilityRole="tablist">
        {scopes.map((name) => {
          const on = name === scope;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => select(name)}
              style={[styles.scope, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line }]}
              testID={`tickets-scope-${name}`}>
              <Text variant="callout" style={{ color: on ? colors.onPrimary : colors.ink }}>
                {t(`tickets.scope.${name}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="footnote" tone="danger" style={styles.pad}>
          {error}
        </Text>
      ) : rows === null ? (
        <Text variant="footnote" tone="inkSoft" style={styles.pad}>
          {t('tickets.loading')}
        </Text>
      ) : !rows.length ? (
        <Text variant="footnote" tone="inkSoft" style={styles.pad}>
          {t('tickets.none')}
        </Text>
      ) : (
        rows.map((row) => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              onOpenThread(row.channelId, row.cardMessageId);
            }}
            style={[styles.row, { borderColor: row.state === 'blocked' ? colors.warnInk : colors.line, backgroundColor: colors.surface }]}
            testID={`tickets-row-${row.id}`}>
            <View style={styles.head}>
              <Text variant="label" tone="inkSoft">
                {row.number}
              </Text>
              <StateChip state={row.state} />
            </View>
            <Text variant="callout" style={styles.bold} numberOfLines={2}>
              {row.name}
            </Text>
            <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
              {[row.requester, row.thread].filter(Boolean).join(' · ')}
            </Text>
            {row.last ? (
              <Text variant="footnote" numberOfLines={1}>
                {row.last}
              </Text>
            ) : null}
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, padding: space.md, gap: 4, maxWidth: 420 },
  ask: { borderWidth: 2, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  options: { gap: space.sm, padding: space.lg },
  detail: { gap: space.sm, padding: space.lg },
  step: { flexDirection: 'row', gap: space.sm },
  scopes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  scope: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  pad: { padding: space.lg },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, gap: 4, marginHorizontal: space.lg, marginBottom: space.sm },
});
