import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, TextInput, View, type TextInputSelectionChangeEvent } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useWindowClass } from '../../../layout/windowClass';
import { radius, space, useTheme } from '../../../theme';
import { FloatingSurface } from '../../../ui/FloatingSurface';
import { useSurface } from '../../../ui/glass';
import { Text } from '../../../ui/Text';
import { chatClient, notifyTyping, send, useChat, type Outgoing } from '../chat';
import { cannedQuery, cannedResponses, markCannedUsed, sendLater, type Canned } from '../composerExtras';
import { hasFeature } from '../features';
import { EmojiPicker } from './EmojiPicker';
import { GifSheet } from './composer/GifSheet';
import { SendLaterSheet } from './composer/SendLaterSheet';
import { clearDraft, readDraft, writeDraft } from '../drafts';
import { dropFile } from '../files';
import { bodyPreview, editableSource } from '../markdown';
import { editMessage, mentionsInBody } from '../messageActions';
import { failureText } from './actions/failure';
import { useUploadLimit } from '../limits';
import { askForPushOnce } from '../push';
import type { Mention, Message } from '../types';
import { pickAttachments, type AttachSource } from './attach';
import { Avatar } from './Avatar';
import { photoFrom } from '../../people/photo';
import { notePhotoList } from '../../people/photos';
import { useChatFormat } from './format';
import { Icon, type IconName } from '../../../ui/icons';
import { AttachSheet, MicButton, RecordingStrip, StagedFile, type Extra } from './MediaControls';
import { useVoiceHold, type Voice } from './useVoiceHold';
import { FormatBar, FormatToggle, useMarkup } from './FormatBar';
import { useBottomInset } from '../../../ui/insets';

type Staged = Outgoing['files'][number];

export type ComposerHandle = { reply(message: Message): void; edit(message: Message): void; restore(body: string, partnerIds: number[]): void; focus(): void };

const now = () => Date.now();
const clock = () => performance.now();

export function mentionQuery(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/\s/.test(query) || query.length > 32) return null;
  return { start: at, query };
}

function RoundButton({ icon, label, onPress, filled, testID }: { icon: IconName; label: string; onPress?: () => void; filled?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [styles.round, { backgroundColor: filled ? colors.primary : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
      <Icon name={icon} color={filled ? colors.onPrimary : colors.inkSoft} />
    </Pressable>
  );
}

export const Composer = forwardRef<ComposerHandle, { accountId: string; channelId: number; messages: Message[]; onSent: () => void; onNotice?: (text: string) => void }>(function Composer(
  { accountId, channelId, messages, onSent, onNotice },
  ref,
) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const bottom = useBottomInset(space.sm, keyboardVisible);
  const { windowClass } = useWindowClass();
  const { size } = useChatFormat();
  const maxBytes = useUploadLimit(chatClient()?.account, 'chat');
  const [initial] = useState(() => readDraft(accountId, channelId));
  const [text, setText] = useState(initial.text);
  const [mentions, setMentions] = useState<Mention[]>(initial.mentions);
  const [parentId, setParentId] = useState<number | null>(initial.parentId);
  const [files, setFiles] = useState<Staged[]>([]);
  const [cursor, setCursor] = useState(initial.text.length);
  const [suggestions, setSuggestions] = useState<Mention[]>([]);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<Message | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [extra, setExtra] = useState<'emoji' | 'gif' | 'later' | null>(null);
  const [laterBusy, setLaterBusy] = useState(false);
  const [canned, setCanned] = useState<Canned[]>([]);
  const features = useChat((state) => state.features);
  const [saving, setSaving] = useState(false);
  const stash = useRef<{ text: string; mentions: Mention[]; parentId: number | null } | null>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const typingAt = useRef(0);
  const hardwareSubmit = windowClass !== 'compact';
  const parent = parentId ? messages.find((message) => message.id === parentId) : null;

  useImperativeHandle(ref, () => ({
    reply: (message) => {
      setParentId(message.id);
      input.current?.focus();
    },
    edit: (message) => {
      if (!editing) stash.current = { text, mentions, parentId };
      const source = editableSource(message.body);
      setEditing(message);
      setParentId(null);
      setText(source);
      setCursor(source.length);
      setMentions(mentionsInBody(message.body).map((mention) => ({ ...mention, token: null })));
      input.current?.focus();
    },
    restore: (body, partnerIds) => {
      const source = editableSource(body);
      const found = mentionsInBody(body).filter((mention) => partnerIds.includes(mention.id));
      setText(source);
      setCursor(source.length);
      setMentions(found.map((mention) => ({ ...mention, token: null })));
      input.current?.focus();
    },
    focus: () => input.current?.focus(),
  }));

  const stagedRef = useRef<Staged[]>([]);
  useEffect(() => {
    stagedRef.current = files;
  }, [files]);
  useEffect(() => () => stagedRef.current.forEach((file) => dropFile(file.uri)), []);

  useEffect(() => {
    if (!editing) writeDraft(accountId, channelId, { text, parentId, mentions });
  }, [accountId, channelId, editing, text, parentId, mentions]);

  const stopEditing = () => {
    const previous = stash.current ?? { text: '', mentions: [], parentId: null };
    stash.current = null;
    setEditing(null);
    setText(previous.text);
    setMentions(previous.mentions);
    setParentId(previous.parentId);
    setCursor(previous.text.length);
  };

  const saveEdit = async () => {
    if (!editing || saving || !text.trim()) return;
    setSaving(true);
    const result = await editMessage(editing, text, mentions);
    setSaving(false);
    if (result.ok) stopEditing();
    else onNotice?.(failureText(t, result));
  };

  const query = mentionQuery(text, cursor);
  const queryText = query?.query ?? null;
  useEffect(() => {
    if (queryText === null) return;
    let live = true;
    const timer = setTimeout(() => {
      void chatClient()
        ?.mentions(channelId, queryText)
        .then((body) => {
          if (!live) return;
          const people = Array.isArray(body.people) ? (body.people as { id: number; name: string; mention_token?: string | null; photo?: unknown }[]) : [];
          notePhotoList(accountId, people.flatMap((person) => {
            const photo = photoFrom(person.photo);
            return photo === undefined ? [] : [[person.id, photo] as const];
          }));
          setSuggestions(people.map((person) => ({ id: person.id, name: person.name, token: person.mention_token ?? null })));
        })
        .catch(() => setSuggestions([]));
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [accountId, channelId, queryText]);

  const cannedAt = cannedQuery(text, cursor);
  const cannedText = cannedAt?.query ?? null;
  useEffect(() => {
    if (cannedText === null) return;
    let live = true;
    const timer = setTimeout(() => void cannedResponses(cannedText).then((result) => live && setCanned(result.ok ? result.value : [])), 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [cannedText]);

  const insertAtCursor = (piece: string, from = cursor) => {
    const next = `${text.slice(0, from)}${piece}${text.slice(cursor)}`;
    setText(next);
    setCursor(from + piece.length);
  };

  const pickCanned = (item: Canned) => {
    if (!cannedAt) return;
    insertAtCursor(item.substitution, cannedAt.start);
    setCanned([]);
    void markCannedUsed(item.id);
  };

  const pickMention = (person: Mention) => {
    if (!query) return;
    const next = `${text.slice(0, query.start)}@${person.name} ${text.slice(cursor)}`;
    setText(next);
    setCursor(query.start + person.name.length + 2);
    setMentions((current) => [...current.filter((item) => item.id !== person.id), person]);
    setSuggestions([]);
  };

  const changeText = (next: string) => {
    setText(next);
    const at = now();
    if (next && at - typingAt.current > 4000) {
      typingAt.current = at;
      notifyTyping(channelId, true);
    }
  };
  const markup = useMarkup(text, changeText, input);

  const delivered = useCallback(
    (key: string | null) => {
      if (!key) return;
      onSent();
      void askForPushOnce(accountId);
    },
    [accountId, onSent],
  );

  const submit = () => {
    if (editing) {
      void saveEdit();
      return;
    }
    const startedAt = clock();
    const outgoing: Outgoing = { channelId, text, parentId, mentions, files, ...(urgent ? { urgent: true } : {}) };
    if (!outgoing.text.trim() && !outgoing.files.length) return;
    stagedRef.current = [];
    setText('');
    setFiles([]);
    setParentId(null);
    setMentions([]);
    setCursor(0);
    setUrgent(false);
    clearDraft(accountId, channelId);
    typingAt.current = 0;
    notifyTyping(channelId, false);
    void send(outgoing, startedAt).then((key) => delivered(key));
  };

  const pickFrom = async (source: AttachSource) => {
    setSheet(false);
    const staged = await pickAttachments(source, t, maxBytes, size);
    if (staged.length) setFiles((current) => [...current, ...staged]);
  };

  const scheduleAt = async (when: number) => {
    setLaterBusy(true);
    const result = await sendLater({ channelId, text, mentions, files, when });
    setLaterBusy(false);
    if (!result.ok) {
      onNotice?.(failureText(t, result));
      return;
    }
    setExtra(null);
    stagedRef.current = [];
    setText('');
    setFiles([]);
    setMentions([]);
    setCursor(0);
    clearDraft(accountId, channelId);
    onNotice?.(t('extras.scheduled'));
  };

  const extras: Extra[] = editing
    ? []
    : [
        { key: 'emoji', icon: 'emoji', label: t('extras.emoji'), onPress: () => { setSheet(false); setExtra('emoji'); } },
        ...(features.gif ? [{ key: 'gif', icon: 'image' as const, label: t('extras.gif'), onPress: () => { setSheet(false); setExtra('gif'); } }] : []),
        { key: 'canned', icon: 'reply', label: t('extras.canned'), onPress: () => { setSheet(false); insertAtCursor('::'); input.current?.focus(); } },
        ...(hasFeature(features, 'send_later') && !parentId
          ? [{ key: 'later', icon: 'clock' as const, label: t('extras.later'), onPress: () => { setSheet(false); if (text.trim() || files.length) setExtra('later'); else onNotice?.(t('extras.laterEmpty')); } }]
          : []),
        ...(hasFeature(features, 'urgent')
          ? [{ key: 'urgent', icon: 'alert' as const, label: urgent ? t('extras.notUrgent') : t('extras.urgent'), detail: features.urgentLeft === null ? undefined : features.urgentLeft < 1 ? t('extras.urgentNone') : t('extras.urgentLeft', { count: features.urgentLeft }), disabled: !urgent && features.urgentLeft !== null && features.urgentLeft < 1, onPress: () => { setSheet(false); setUrgent((value) => !value); } }]
          : []),
      ];

  const sendVoice = (voice: Voice) => {
    const startedAt = clock();
    const replyTo = parentId;
    if (replyTo) setParentId(null);
    void send({ channelId, text: '', parentId: replyTo, mentions: [], files: [voice] }, startedAt).then((key) => delivered(key));
  };
  const voice = useVoiceHold(sendVoice);
  const recording = voice.recording;

  const canSend = (text.trim().length > 0 || files.length > 0) && !recording;
  const glass = useSurface() === 'glass';

  return (
    <View style={[styles.container, glass ? styles.bare : { borderTopColor: colors.line }, { backgroundColor: colors.canvas, paddingBottom: bottom }]} testID="composer">
      {queryText !== null && suggestions.length ? (
        <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="mention-suggestions">
          {suggestions.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              onPress={() => pickMention(person)}
              style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.surface2 }]}
              testID={`mention-${person.id}`}>
              <Avatar name={person.name} seed={person.id} partnerId={person.id} size={32} />
              <Text variant="callout" numberOfLines={1} style={styles.flex}>
                {person.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {cannedText !== null && canned.length ? (
        <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="canned-suggestions">
          {canned.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" onPress={() => pickCanned(item)} style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.surface2 }]} testID={`canned-${item.id}`}>
              <Text variant="callout" style={styles.strong}>
                {item.source}
              </Text>
              <Text variant="footnote" tone="inkSoft" numberOfLines={1} style={styles.flex}>
                {item.substitution}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {urgent ? (
        <View style={[styles.replyBar, { backgroundColor: colors.warnBand }]} testID="composer-urgent">
          <Icon name="alert" color={colors.warnInk} />
          <Text variant="footnote" tone="warnInk" style={[styles.flex, styles.strong]}>
            {t('extras.urgentOn')}
          </Text>
          <RoundButton icon="close" label={t('extras.notUrgent')} onPress={() => setUrgent(false)} />
        </View>
      ) : null}
      {editing ? (
        <View style={[styles.replyBar, { backgroundColor: colors.surface2 }]} testID="composer-editing">
          <View style={styles.flex}>
            <Text variant="footnote" style={styles.strong}>
              {t('composer.editing')}
            </Text>
            <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
              {bodyPreview(editing.body)}
            </Text>
          </View>
          <RoundButton icon="close" label={t('composer.cancelEdit')} onPress={stopEditing} testID="composer-cancel-edit" />
        </View>
      ) : null}
      {parentId ? (
        <View style={[styles.replyBar, { backgroundColor: colors.surface2 }]} testID="composer-reply">
          <View style={styles.flex}>
            <Text variant="footnote" style={[styles.strong, { color: colors.ink }]}>
              {t('composer.replyingTo', { name: parent?.author ?? '' })}
            </Text>
            <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
              {parent ? bodyPreview(parent.body) || t('list.files', { count: parent.attachments.length }) : ''}
            </Text>
          </View>
          <RoundButton icon="close" label={t('composer.cancelReply')} onPress={() => setParentId(null)} />
        </View>
      ) : null}
      {files.length ? (
        <ScrollView horizontal contentContainerStyle={styles.staged} showsHorizontalScrollIndicator={false}>
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
      <View style={styles.row}>
        {recording ? (
          <RecordingStrip recording={recording} />
        ) : (
          <>
            {editing ? null : <RoundButton icon="attach" label={t('composer.attach')} onPress={() => setSheet(true)} testID="composer-attach" />}
            {markup.showToggle ? <FormatToggle onPress={markup.show} /> : null}
            <FloatingSurface solid={colors.surface} style={[styles.field, glass ? styles.bare : { borderColor: colors.line }]}>
              <TextInput
                ref={input}
                value={text}
                onChangeText={changeText}
                onSelectionChange={(event: TextInputSelectionChangeEvent) => {
                  setCursor(event.nativeEvent.selection.end);
                  markup.inputProps.onSelectionChange(event);
                }}
                onFocus={markup.inputProps.onFocus}
                onBlur={markup.inputProps.onBlur}
                placeholder={t('composer.placeholder')}
                placeholderTextColor={colors.inkFaint}
                multiline
                disableFullscreenUI
                submitBehavior={hardwareSubmit ? 'submit' : 'newline'}
                returnKeyType={hardwareSubmit ? 'send' : 'default'}
                onSubmitEditing={hardwareSubmit ? submit : undefined}
                accessibilityLabel={t('composer.placeholder')}
                testID="composer-input"
                style={[styles.input, { color: colors.ink }]}
              />
            </FloatingSurface>
          </>
        )}
        {editing ? (
          <RoundButton icon="check" label={t('composer.saveEdit')} filled onPress={submit} testID="composer-save-edit" />
        ) : (
          <>
            {canSend ? <RoundButton icon="send" label={t('composer.send')} filled onPress={submit} testID="composer-send" /> : null}
            <MicButton voice={voice} hidden={canSend} />
          </>
        )}
      </View>
      {markup.showBar && !recording ? <FormatBar onApply={markup.apply} onHide={markup.hide} /> : null}
      <AttachSheet visible={sheet} onClose={() => setSheet(false)} onPick={(source) => void pickFrom(source)} extras={extras} />
      {extra === 'emoji' ? <EmojiPicker onClose={() => setExtra(null)} onPick={(emoji) => { setExtra(null); insertAtCursor(emoji); }} /> : null}
      {extra === 'gif' ? (
        <GifSheet
          onClose={() => setExtra(null)}
          onPick={(gif) => {
            setExtra(null);
            void send({ channelId, text: gif.url, parentId, mentions: [], files: [] }, clock()).then((key) => delivered(key));
            setParentId(null);
          }}
        />
      ) : null}
      {extra === 'later' ? <SendLaterSheet busy={laterBusy} onClose={() => setExtra(null)} onPick={(when) => void scheduleAt(when)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '600' },
  container: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, paddingHorizontal: space.sm, gap: space.sm },
  bare: { borderWidth: 0, borderTopWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, justifyContent: 'center' },
  input: { fontSize: 16, lineHeight: 22, maxHeight: 132, paddingTop: Platform.OS === 'ios' ? 11 : 8, paddingBottom: Platform.OS === 'ios' ? 11 : 8 },
  suggestions: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.sm, paddingLeft: space.md },
  staged: { gap: space.sm },
});
