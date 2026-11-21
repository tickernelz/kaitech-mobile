import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputSelectionChangeEvent } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowClass } from '../../../layout/windowClass';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { chatClient, notifyTyping, send, type Outgoing } from '../chat';
import { clearDraft, readDraft, writeDraft } from '../drafts';
import { dropFile } from '../files';
import { plainText } from '../html';
import { useUploadLimit } from '../limits';
import { askForPushOnce } from '../push';
import type { Mention, Message } from '../types';
import { pickAttachments, type AttachSource } from './attach';
import { Avatar } from './Avatar';
import { authorColor } from './MessageBubble';
import { useChatFormat } from './format';
import { Icon, type IconName } from '../../../ui/icons';
import { AttachSheet, MicButton, RecordingStrip, StagedFile } from './MediaControls';
import { useVoiceHold, type Voice } from './useVoiceHold';

type Staged = Outgoing['files'][number];

export type ComposerHandle = { reply(message: Message): void; focus(): void };

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

export const Composer = forwardRef<ComposerHandle, { accountId: string; channelId: number; messages: Message[]; onSent: () => void }>(function Composer(
  { accountId, channelId, messages, onSent },
  ref,
) {
  const { t } = useTranslation('chat');
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
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
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const typingAt = useRef(0);
  const hardwareSubmit = windowClass !== 'compact';
  const parent = parentId ? messages.find((message) => message.id === parentId) : null;
  const replyTint = authorColor(parent?.authorId ?? null, scheme, colors);

  useImperativeHandle(ref, () => ({
    reply: (message) => {
      setParentId(message.id);
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
    writeDraft(accountId, channelId, { text, parentId, mentions });
  }, [accountId, channelId, text, parentId, mentions]);

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
          const people = Array.isArray(body.people) ? (body.people as { id: number; name: string; mention_token?: string | null }[]) : [];
          setSuggestions(people.map((person) => ({ id: person.id, name: person.name, token: person.mention_token ?? null })));
        })
        .catch(() => setSuggestions([]));
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [channelId, queryText]);

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

  const delivered = useCallback(
    (key: string | null) => {
      if (!key) return;
      onSent();
      void askForPushOnce(accountId);
    },
    [accountId, onSent],
  );

  const submit = () => {
    const startedAt = clock();
    const outgoing: Outgoing = { channelId, text, parentId, mentions, files };
    if (!outgoing.text.trim() && !outgoing.files.length) return;
    stagedRef.current = [];
    setText('');
    setFiles([]);
    setParentId(null);
    setMentions([]);
    setCursor(0);
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

  const sendVoice = (voice: Voice) => {
    const startedAt = clock();
    const replyTo = parentId;
    if (replyTo) setParentId(null);
    void send({ channelId, text: '', parentId: replyTo, mentions: [], files: [voice] }, startedAt).then((key) => delivered(key));
  };
  const voice = useVoiceHold(sendVoice);
  const recording = voice.recording;

  const canSend = (text.trim().length > 0 || files.length > 0) && !recording;
  const bottom = keyboardVisible ? space.sm : Math.max(insets.bottom, space.sm);

  return (
    <View style={[styles.container, { borderTopColor: colors.line, backgroundColor: colors.canvas, paddingBottom: bottom }]} testID="composer">
      {queryText !== null && suggestions.length ? (
        <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="mention-suggestions">
          {suggestions.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              onPress={() => pickMention(person)}
              style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.surface2 }]}
              testID={`mention-${person.id}`}>
              <Avatar name={person.name} seed={person.id} size={32} />
              <Text variant="callout" numberOfLines={1} style={styles.flex}>
                {person.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {parentId ? (
        <View style={[styles.replyBar, { backgroundColor: colors.surface2, borderColor: replyTint }]} testID="composer-reply">
          <View style={styles.flex}>
            <Text variant="footnote" style={[styles.strong, { color: replyTint }]}>
              {t('composer.replyingTo', { name: parent?.author ?? '' })}
            </Text>
            <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
              {parent ? plainText(parent.body) || t('list.files', { count: parent.attachments.length }) : ''}
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
            <RoundButton icon="attach" label={t('composer.attach')} onPress={() => setSheet(true)} testID="composer-attach" />
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <TextInput
                ref={input}
                value={text}
                onChangeText={changeText}
                onSelectionChange={(event: TextInputSelectionChangeEvent) => setCursor(event.nativeEvent.selection.end)}
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
            </View>
          </>
        )}
        {canSend ? <RoundButton icon="send" label={t('composer.send')} filled onPress={submit} testID="composer-send" /> : null}
        <MicButton voice={voice} hidden={canSend} />
      </View>
      <AttachSheet visible={sheet} onClose={() => setSheet(false)} onPick={(source) => void pickFrom(source)} />
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '600' },
  container: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, paddingHorizontal: space.sm, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, justifyContent: 'center' },
  input: { fontSize: 16, lineHeight: 22, maxHeight: 132, paddingTop: Platform.OS === 'ios' ? 11 : 8, paddingBottom: Platform.OS === 'ios' ? 11 : 8 },
  suggestions: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderLeftWidth: 3, borderRadius: radius.sm, paddingLeft: space.sm },
  staged: { gap: space.sm },
});
