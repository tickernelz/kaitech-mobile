import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { update, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { readableWidth, useWindowClass } from '../../layout/windowClass';
import { radius, space, type as typography, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { localFile, dropFile } from '../chat/files';
import { useUploadLimit } from '../chat/limits';
import { coworkerFallbackBytes, withinBudget } from '../chat/uploadRule';
import { pickAttachments, type AttachSource, type Picked } from '../chat/ui/attach';
import { useChatFormat } from '../chat/ui/format';
import { Icon } from '../../ui/icons';
import { AttachSheet, MicButton, RecordingStrip, StagedFile, UploadProgress } from '../chat/ui/MediaControls';
import { Attachments } from '../chat/ui/MessageBubble';
import { useVoiceHold, type Voice } from '../chat/ui/useVoiceHold';
import { ask, cards as readCards, panel, transcript, type Card, type Cursor, type Document, type TranscriptItem } from './api';
import { DecisionCard } from './DecisionCard';
import { chatAttachments } from './files';
import { Markdown } from './Markdown';
import { sourceBlocks } from '../chat/markdown';
import { FormatBar, FormatToggle, useMarkup } from '../chat/ui/FormatBar';
import { RichText } from '../chat/ui/RichText';
import { flushDrafts, openConversation, readDraft, useOpenConversation, writeDraft } from './store';
import { entriesOf, mergeItems, stepCount, stepLine, type Entry } from './thread';
import { IconButton, StateView, useErrorText } from './ui';

const pollMs = 2500;

type Staged = Picked | Voice;
type Pending = { key: string; text: string; failed: unknown; turnId?: number; files: Staged[]; sent: number | null };

function documentsOf(files: Staged[]): Promise<Document[]> {
  return Promise.all(files.map(async (file) => ({ name: file.name, mimetype: file.mimetype, data: await localFile(file.uri).base64() })));
}

function PendingFile({ file, sent }: { file: Staged; sent: number | null }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { duration } = useChatFormat();
  const name = file.voice ? t('composer.voiceLength', { length: duration(file.durationMs) }) : file.name;
  return (
    <View style={[styles.pendingFile, { backgroundColor: colors.surface }]}>
      <Icon name={file.voice ? 'mic' : file.mimetype.startsWith('image/') ? 'image' : 'file'} color={colors.inkSoft} />
      <View style={styles.fill}>
        {sent === null ? (
          <Text variant="callout" numberOfLines={1}>
            {name}
          </Text>
        ) : (
          <UploadProgress name={name} sent={sent} testID="coworker-upload-progress" />
        )}
      </View>
    </View>
  );
}

function JobCard({ item, origin, testID }: { item: TranscriptItem; origin: string; testID: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const state = item.state === 'done' || item.state === 'failed' ? item.state : 'running';
  return (
    <View style={[styles.job, { borderColor: state === 'failed' ? colors.dangerInk : colors.line, backgroundColor: colors.surface }]} testID={`${testID}-job-${state}`}>
      <View style={styles.row} accessibilityLiveRegion="polite">
        {state === 'running' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Icon name={state === 'done' ? 'check' : 'alert'} color={state === 'done' ? colors.primary : colors.dangerInk} />
        )}
        <Text variant="headline" tone={state === 'failed' ? 'dangerInk' : undefined} style={styles.fill}>
          {t(`discovery.thread.job.${state}`)}
        </Text>
      </View>
      {item.body ? <Markdown text={item.body} /> : null}
      <Attachments attachments={chatAttachments(item.attachments)} origin={origin} mine={false} />
    </View>
  );
}

function useTranscript(conversation: number | null) {
  const { active } = useSession();
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [following, setFollowing] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const cursor = useRef<Cursor | undefined>(undefined);
  const busy = useRef(false);
  const focused = useRef(true);

  const pull = useCallback(async () => {
    if (!active || !conversation || busy.current) return;
    busy.current = true;
    setLoading(!cursor.current);
    try {
      const next = await transcript(active, conversation, cursor.current);
      cursor.current = next.cursor;
      setItems((current) => mergeItems(current, next.items));
      setFollowing(next.following);
      setPendingQuestion(next.pending_question);
      setError(null);
    } catch (failure) {
      setError(failure);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [active, conversation]);

  useEffect(() => {
    void pull();
  }, [pull]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!following) return;
    const timer = setInterval(() => {
      if (focused.current && AppState.currentState === 'active') void pull();
    }, pollMs);
    return () => clearInterval(timer);
  }, [following, pull]);

  return { items, following, pendingQuestion, error, loading, pull, setFollowing };
}

function Bubble({ mine, children, testID }: { mine: boolean; children: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.bubble,
        mine
          ? [styles.mine, { backgroundColor: colors.select }]
          : [styles.theirs, { backgroundColor: colors.surface, borderColor: colors.line }],
      ]}>
      {children}
    </View>
  );
}

function Steps({ entry }: { entry: Extract<Entry, { kind: 'steps' }> }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((value) => !value)}
      style={[styles.steps, { borderColor: colors.line, backgroundColor: colors.surface2 }]}>
      <View style={styles.row}>
        <Icon name="steps" size={16} color={colors.inkSoft} />
        <Text variant="footnote" tone="inkSoft" style={styles.fill} numberOfLines={open ? undefined : 2}>
          {stepLine(entry.steps) || t('discovery.thread.steps', { count: stepCount(entry.steps) })}
        </Text>
        <Text variant="footnote" tone="inkFaint">
          {t('discovery.thread.steps', { count: stepCount(entry.steps) })}
        </Text>
      </View>
      {open
        ? entry.steps
            .filter((step) => step.kind === 'tool_call')
            .map((step) => (
              <Text key={`${step.turnId}:${step.seq}`} variant="footnote" tone="inkSoft">
                {step.intention?.trim() || step.name}
              </Text>
            ))
        : null}
    </Pressable>
  );
}

export function CoworkerThread({
  programme,
  focusCard,
  focusInput = 0,
  prefill = '',
  testID = 'coworker',
}: {
  programme: number;
  focusCard?: number;
  focusInput?: number;
  prefill?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const errorText = useErrorText();
  const account = active?.id ?? '';
  const conversation = useOpenConversation(account, programme);
  const [draft, setDraftText] = useState(() => readDraft(account, programme, conversation) || (conversation ? '' : prefill));
  const setDraft = (text: string) => {
    setDraftText(text);
    writeDraft(account, programme, conversation, text);
  };
  const [pending, setPending] = useState<Pending[]>([]);
  const [files, setFiles] = useState<Staged[]>([]);
  const [sheet, setSheet] = useState(false);
  const maxBytes = useUploadLimit(active, 'coworker') ?? coworkerFallbackBytes;
  const { t: chatT } = useTranslation('chat');
  const { size } = useChatFormat();
  const held = useRef<{ files: Staged[]; pending: Pending[] }>({ files: [], pending: [] });
  const sending = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    held.current = { files, pending };
  }, [files, pending]);
  useEffect(() => {
    mounted.current = true;
    const inFlight = sending.current;
    return () => {
      mounted.current = false;
      const { files: staged, pending: unsent } = held.current;
      const abandoned = unsent.filter((entry) => entry.turnId === undefined && !inFlight.has(entry.key));
      [...staged, ...abandoned.flatMap((entry) => entry.files)].forEach((file) => dropFile(file.uri));
    };
  }, []);
  const thread = useTranscript(conversation);
  const programmePanel = useResource(`discovery.panel.${programme}`, (signedIn) => panel(signedIn, programme));
  const list = useRef<FlatList<Entry | Pending | Card>>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const markup = useMarkup(draft, setDraft, input);
  const { windowClass, width } = useWindowClass();

  useEffect(() => {
    if (focusInput) input.current?.focus();
  }, [focusInput]);

  useEffect(() => flushDrafts, []);

  const cardIds = useMemo(() => {
    const ids = (programmePanel.data?.packets ?? [])
      .filter((packet) => conversation && packet.conversation_id === conversation)
      .map((packet) => packet.id);
    return focusCard && !ids.includes(focusCard) ? [...ids, focusCard] : ids;
  }, [programmePanel.data, conversation, focusCard]);
  const cardKey = `discovery.threadCards.${programme}.${cardIds.join(',')}`;
  const threadCards = useResource(cardIds.length ? cardKey : null, (signedIn) => readCards(signedIn, cardIds), 10_000);

  const asked = useMemo(() => new Set(thread.items.filter((item) => item.kind === 'request').map((item) => item.turnId)), [thread.items]);
  const shownPending = pending.filter((entry) => entry.turnId === undefined || !asked.has(entry.turnId));

  const send = async (entry: Pending) => {
    if (!active || sending.current.has(entry.key)) return;
    sending.current.add(entry.key);
    setPending((current) => [...current.filter((other) => other.key !== entry.key), { ...entry, failed: null, sent: null }]);
    try {
      const documents = await documentsOf(entry.files);
      const answer = await ask(
        active,
        { key: entry.key, request: entry.text, conversationId: conversation ?? undefined, programme, documents },
        documents.length ? (fraction) => progressOf(entry.key, fraction) : undefined,
      );
      entry.files.forEach((file) => dropFile(file.uri));
      setPending((current) => current.map((other) => (other.key === entry.key ? { ...other, turnId: answer.turn_id, sent: null } : other)));
      if (answer.conversation_id !== conversation) openConversation(account, programme, answer.conversation_id);
      thread.setFollowing(true);
      void thread.pull();
      void programmePanel.refresh();
    } catch (failure) {
      if (!mounted.current) entry.files.forEach((file) => dropFile(file.uri));
      setPending((current) => current.map((other) => (other.key === entry.key ? { ...other, failed: failure, sent: null } : other)));
    } finally {
      sending.current.delete(entry.key);
    }
  };

  const progressOf = (key: string, fraction: number) => {
    const next = Math.round(fraction * 100) / 100;
    setPending((current) => (current.some((other) => other.key === key && other.sent !== next) ? current.map((other) => (other.key === key ? { ...other, sent: next } : other)) : current));
  };

  const voice = useVoiceHold((recorded) => void send({ key: randomUUID(), text: '', failed: null, files: [recorded], sent: null }));

  const pickFrom = async (source: AttachSource) => {
    setSheet(false);
    const staged = await pickAttachments(source, chatT, maxBytes, size);
    const { kept, refused } = withinBudget(held.current.files, staged, maxBytes);
    refused.forEach((file) => dropFile(file.uri));
    if (refused.length) Alert.alert('', chatT('composer.tooMuch', { count: refused.length, names: refused.map((file) => file.name).join(', '), limit: size(maxBytes) }));
    if (kept.length) setFiles((current) => [...current, ...kept]);
  };

  const reply = (text: string) => void send({ key: randomUUID(), text, failed: null, files: [], sent: null });
  const submit = () => {
    const text = draft.trim();
    if ((!text && !files.length) || !active) return;
    const outgoing = files;
    setDraft('');
    setFiles([]);
    input.current?.clear();
    if (windowClass === 'compact') Keyboard.dismiss();
    void send({ key: randomUUID(), text, failed: null, files: outgoing, sent: null });
  };

  const entries = useMemo(() => entriesOf(thread.items), [thread.items]);
  const data: (Entry | Pending | Card)[] = [...entries, ...shownPending, ...(threadCards.data ?? [])];

  const onAnswered = (next: Card) => {
    if (threadCards.key) update<Card[]>(threadCards.key, (current) => (current ?? []).map((card) => (card.id === next.id ? next : card)));
    void programmePanel.refresh();
    void thread.pull();
  };

  const render = ({ item }: { item: Entry | Pending | Card }) => {
    if ('title' in item) return <DecisionCard card={item} onAnswered={onAnswered} />;
    if ('key' in item) {
      return (
        <View style={styles.pendingWrap}>
          <Bubble mine testID={`${testID}-pending`}>
            {item.files.map((file) => (
              <PendingFile key={file.uri} file={file} sent={item.failed ? null : item.sent} />
            ))}
            {item.text ? <RichText blocks={sourceBlocks(item.text, false)} tint={colors.surface} /> : null}
          </Bubble>
          {item.failed ? (
            <Pressable accessibilityRole="button" onPress={() => void send(item)} style={styles.retry} testID={`${testID}-retry`}>
              <Text variant="footnote" tone="dangerInk">
                {errorText(item.failed)} {t('discovery.retry')}
              </Text>
            </Pressable>
          ) : (
            <Text variant="footnote" tone="inkFaint" style={styles.status}>
              {t('discovery.thread.sending')}
            </Text>
          )}
        </View>
      );
    }
    if (item.kind === 'request') {
      return (
        <Bubble mine testID={`${testID}-request`}>
          <Attachments attachments={chatAttachments(item.item.attachments)} origin={active?.origin ?? ''} mine />
          {item.item.body ? <RichText blocks={sourceBlocks(item.item.body, false)} tint={colors.surface} selectable /> : null}
        </Bubble>
      );
    }
    if (item.kind === 'reply') {
      return (
        <Bubble mine={false} testID={`${testID}-reply`}>
          {item.item.body.trim() ? <Markdown text={item.item.body} onReply={reply} /> : null}
          <Attachments attachments={chatAttachments(item.item.attachments)} origin={active?.origin ?? ''} mine={false} />
        </Bubble>
      );
    }
    if (item.kind === 'failure') {
      return (
        <View style={[styles.failure, { backgroundColor: colors.dangerBand }]} testID={`${testID}-failure`}>
          <Text tone="dangerInk">{item.item.failure?.said || t('discovery.thread.failed')}</Text>
          {item.item.failure?.help ? (
            <Text variant="footnote" tone="dangerInk">
              {item.item.failure.help}
            </Text>
          ) : null}
        </View>
      );
    }
    if (item.kind === 'job') return <JobCard item={item.item} origin={active?.origin ?? ''} testID={testID} />;
    return <Steps entry={item} />;
  };

  const canSend = (draft.trim().length > 0 || files.length > 0) && !voice.recording;
  const empty = !conversation && !shownPending.length;
  return (
    <KeyboardAvoidingView key={width} behavior="padding" automaticOffset style={styles.fill} testID={testID}>
      {empty ? (
        <StateView empty={{ title: t('discovery.thread.emptyTitle'), body: t('discovery.thread.emptyBody') }} testID={testID} />
      ) : thread.loading && !thread.items.length ? (
        <StateView loading testID={testID} />
      ) : thread.error && !thread.items.length ? (
        <StateView error={thread.error} onRetry={() => void thread.pull()} testID={testID} />
      ) : (
        <FlatList
          ref={list}
          data={data}
          keyExtractor={(item) => ('title' in item ? `card-${item.id}` : 'key' in item ? item.key : item.id)}
          renderItem={render}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            thread.following ? (
              <Text variant="footnote" tone="inkSoft" style={styles.working} accessibilityLiveRegion="polite" testID={`${testID}-working`}>
                {thread.pendingQuestion ? t('discovery.thread.waitingForYou') : t('discovery.thread.working')}
              </Text>
            ) : undefined
          }
        />
      )}
      {files.length ? (
        <ScrollView horizontal contentContainerStyle={styles.staged} style={{ backgroundColor: colors.canvas }} showsHorizontalScrollIndicator={false} testID={`${testID}-staged`}>
          {files.map((file, index) => (
            <StagedFile
              key={file.uri}
              name={file.name}
              mimetype={file.mimetype}
              onRemove={() => {
                dropFile(file.uri);
                setFiles((current) => current.filter((_, position) => position !== index));
              }}
            />
          ))}
        </ScrollView>
      ) : null}
      <View style={[styles.composer, { borderColor: colors.line, backgroundColor: colors.canvas }]}>
        {voice.recording ? (
          <RecordingStrip recording={voice.recording} />
        ) : (
          <>
            <IconButton icon="attach" label={t('discovery.thread.attach')} onPress={() => setSheet(true)} testID={`${testID}-attach`} />
            {markup.showToggle ? <FormatToggle onPress={markup.show} /> : null}
            <TextInput
              ref={input}
              value={draft}
              onChangeText={setDraft}
              {...markup.inputProps}
              placeholder={t('discovery.thread.placeholder')}
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel={t('discovery.thread.placeholder')}
              multiline
              disableFullscreenUI
              submitBehavior="submit"
              returnKeyType="send"
              onSubmitEditing={submit}
              selectionColor={colors.focus}
              testID={`${testID}-input`}
              style={[typography.body, styles.input, { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.edge }]}
            />
          </>
        )}
        {canSend ? <IconButton icon="send" label={t('discovery.thread.send')} filled onPress={submit} testID={`${testID}-send`} /> : null}
        <MicButton voice={voice} hidden={canSend} testID={`${testID}-mic`} />
      </View>
      {markup.showBar && !voice.recording ? (
        <View style={[styles.formatBar, { backgroundColor: colors.canvas }]}>
          <FormatBar onApply={markup.apply} onHide={markup.hide} />
        </View>
      ) : null}
      <AttachSheet visible={sheet} onClose={() => setSheet(false)} onPick={(source) => void pickFrom(source)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pendingFile: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, minHeight: 48, minWidth: 220 },
  job: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.sm },
  staged: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { padding: space.lg, gap: space.md, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  bubble: { borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: radius.sm },
  theirs: { alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.sm },
  steps: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  failure: { borderRadius: radius.card, padding: space.lg, gap: space.xs },
  pendingWrap: { gap: space.xs },
  status: { alignSelf: 'flex-end' },
  retry: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  working: { textAlign: 'center', paddingVertical: space.sm },
  formatBar: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minHeight: 44, maxHeight: 160, borderRadius: radius.field, borderWidth: 1, paddingHorizontal: space.lg, paddingTop: 11, paddingBottom: 11 },
});
