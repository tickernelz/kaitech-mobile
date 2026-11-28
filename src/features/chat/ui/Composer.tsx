import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentRef, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type TextInputSelectionChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Pressable } from '../../../ui/Pressable';
import { KeyboardController, useKeyboardState, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useWindowClass } from '../../../layout/windowClass';
import { radius, space, useTheme } from '../../../theme';
import { duration, easing, spring, useMotion } from '../../../theme/motion';
import { GlassCapsule, useGlassShadow } from '../../../ui/GlassCapsule';
import { haptic } from '../../../ui/haptic';
import { Text } from '../../../ui/Text';
import { chatClient, notifyTyping, send, useChat, type Outgoing } from '../chat';
import { cannedQuery, cannedResponses, deleteBefore, markCannedUsed, sendLater, type Canned } from '../composerExtras';
import { hasFeature } from '../features';
import { CameraSlot, FieldButton, LockPill, SendMicButton, ShortHint, controlGap, useSolidCapsule } from './composer/Controls';
import { sendModeOf } from './composer/gesture';
import { useVoiceRecorder, type Voice } from './composer/useVoiceRecorder';
import { DiscardAnimation, InterruptionBanner, VoiceRow, voiceRowPhase } from './composer/VoiceBar';
import { useScreenReader } from '../../call/ui/useAutoHide';
import { useTapToRecord } from '../voice/tapSetting';
import { ComposerPanel } from './composer/Panel';
import { halfPanelHeight, searchPanelHeight } from './composer/panel/logic';
import { SendLaterSheet } from './composer/SendLaterSheet';
import { clearDraft, readDraft, writeDraft } from '../drafts';
import { dropFile } from '../files';
import { bodyPreview, editableSource } from '../markdown';
import { editMessage, mentionsInBody } from '../messageActions';
import { failureText } from './actions/failure';
import { useUploadLimit } from '../limits';
import { askForPushOnce } from '../push';
import type { GifMedia, Mention, Message, Rich, Sticker } from '../types';
import { pickAttachments, type AttachSource } from './attach';
import { Avatar } from './Avatar';
import { photoFrom } from '../../people/photo';
import { notePhotoList } from '../../people/photos';
import { useChatFormat } from './format';
import { Icon, type IconName } from '../../../ui/icons';
import { StagedFile } from './MediaControls';
import { AttachSheet, type Extra } from './composer/AttachSheet';
import { LocationPicker } from './composer/LocationPicker';
import { PollSheet } from './composer/PollSheet';
import { richLabel } from './RichMedia';
import { FormatBar, useMarkup } from './FormatBar';
import { useBottomInset } from '../../../ui/insets';
import { glassEdge, pill } from '../../../ui/pill';
import { touchTarget } from '../../../ui/touch';
import { hideWhen } from '../../../ui/cover';

type Staged = Outgoing['files'][number];

export type ComposerHandle = { reply(message: Message): void; edit(message: Message): void; restore(body: string, partnerIds: number[]): void; focus(): void; closePanel(): void };

const inputLine = 22;
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

function RoundButton({
  icon,
  label,
  onPress,
  filled,
  inRow,
  inCapsule,
  testID,
  ref,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  filled?: boolean;
  inRow?: boolean;
  inCapsule?: boolean;
  testID?: string;
  ref?: Ref<ComponentRef<typeof View>>;
}) {
  const { colors } = useTheme();
  const lift = useGlassShadow('thick', true);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [styles.round, inRow && styles.rowButton, inCapsule && styles.capsuleButton, filled && inRow && lift, { backgroundColor: filled ? colors.primary : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
      <Icon name={icon} color={filled ? colors.onPrimary : colors.inkSoft} />
    </Pressable>
  );
}

export const Composer = forwardRef<
  ComposerHandle,
  { accountId: string; channelId: number; messages: Message[]; onSent: () => void; onNotice?: (text: string) => void; onOverlap?: (height: number) => void }
>(function Composer(
  { accountId, channelId, messages, onSent, onNotice, onOverlap },
  ref,
) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
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
  const attachButton = useRef<ComponentRef<typeof View>>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [extra, setExtra] = useState<'later' | 'poll' | 'location' | null>(null);
  const [panel, setPanel] = useState(false);
  const [panelKept, setPanelKept] = useState(false);
  const [searching, setSearching] = useState(false);
  const [panelHeight, setPanelHeight] = useState(() => halfPanelHeight(0));
  const [full, setFull] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const closeRef = useRef<() => void>(() => undefined);
  const keyboardHeight = useKeyboardState((state) => state.height);
  const origin = useChat((state) => state.origin);
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
    closePanel: () => closeRef.current(),
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
    haptic.send();
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
  const screenReader = useScreenReader();
  const tapSetting = useTapToRecord();
  const tapMode = screenReader || tapSetting;
  const voice = useVoiceRecorder({ accountId, channelId, tapMode, onSend: sendVoice });
  const voicePhase = voiceRowPhase(voice);
  const [discarding, setDiscarding] = useState(false);
  const cancelled = voice.state.phase === 'cancelled';
  const [seenCancel, setSeenCancel] = useState(false);
  if (cancelled !== seenCancel) {
    setSeenCancel(cancelled);
    if (cancelled) setDiscarding(true);
  }
  const endDiscard = useCallback(() => setDiscarding(false), []);
  const mode = sendModeOf({ text, files: files.length, locked: voicePhase === 'locked' || voicePhase === 'paused' });

  const sendRich = (rich: Rich) => {
    haptic.send();
    const replyTo = parentId;
    if (replyTo) setParentId(null);
    void send({ channelId, text: '', parentId: replyTo, mentions: [], files: [], rich }, clock()).then((key) => delivered(key));
  };

  const reduceMotion = useReducedMotion();
  const keyboard = useReanimatedKeyboardAnimation();
  const open = useSharedValue(0);
  const reopening = useRef(false);
  const formatBarSpace = useRef(0);
  const openPanel = () => {
    setPanelHeight(halfPanelHeight(keyboardHeight) + (markup.showBar ? formatBarSpace.current : 0));
    setFull(false);
    reopening.current = false;
    setPanel(true);
    setPanelKept(true);
    open.set(keyboardVisible || reduceMotion ? 1 : withTiming(1, { duration: duration.slow, easing: easing.expo }));
    void KeyboardController.dismiss();
  };
  const closePanel = useCallback(() => {
    setSearching(false);
    setFull(false);
    open.set(
      reduceMotion
        ? 0
        : withTiming(0, { duration: duration.base, easing: easing.exit }, (done) => {
          if (done) scheduleOnRN(setPanel, false);
        }),
    );
    if (reduceMotion) setPanel(false);
  }, [open, reduceMotion]);
  useEffect(() => {
    closeRef.current = closePanel;
  }, [closePanel]);
  const sizePanel = useCallback(
    (next: 'full' | 'half' | 'close') => {
      if (next === 'close') closePanel();
      else setFull(next === 'full');
    },
    [closePanel],
  );
  const fullHeight = Math.max(halfPanelHeight(keyboardHeight) + 80, Math.round(windowHeight * 0.6));
  const target = searching ? searchPanelHeight : full ? fullHeight : panelHeight;
  const grown = useSharedValue(target);
  useEffect(() => {
    grown.set(reduceMotion ? withTiming(target, { duration: duration.quick }) : withSpring(target, spring.spatial));
  }, [grown, reduceMotion, target]);
  const showKeyboard = () => {
    reopening.current = true;
    setSearching(false);
    input.current?.focus();
  };
  useEffect(() => {
    if (!panel || !keyboardVisible || !reopening.current) return;
    reopening.current = false;
    open.set(0);
    setPanel(false);
  }, [keyboardVisible, open, panel]);
  useEffect(() => {
    if (!panel) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      closePanel();
      return true;
    });
    return () => back.remove();
  }, [closePanel, panel]);
  const panelStyle = useAnimatedStyle(() => ({
    height: open.get() * (searching ? grown.get() : Math.max(0, grown.get() + keyboard.height.get())),
  }));
  const backspace = () => {
    const next = deleteBefore(text, cursor);
    setText(next.text);
    setCursor(next.cursor);
  };

  const voiceIn = useMotion(FadeIn.duration(duration.quick));
  const composeIn = useMotion(FadeIn.duration(duration.quick).delay(discarding ? 680 : 0));
  const groupOut = useMotion(FadeOut.duration(duration.quick));
  const bottom = useBottomInset(space.sm, keyboardVisible || panel);
  const resting = useBottomInset(space.sm);
  const [floatHeight, setFloatHeight] = useState(0);
  useEffect(() => {
    if (floatHeight) onOverlap?.(space.sm + floatHeight + resting);
  }, [floatHeight, onOverlap, resting]);
  const solidCapsule = useSolidCapsule();

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingBottom: bottom }]} testID="composer">
      {queryText !== null && suggestions.length ? (
        <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.line }]} importantForAccessibility={hideWhen(sheet)} testID="mention-suggestions">
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
        <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.line }]} importantForAccessibility={hideWhen(sheet)} testID="canned-suggestions">
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
      <View
        pointerEvents="box-none"
        collapsable={false}
        importantForAccessibility={hideWhen(sheet)}
        style={styles.float}
        onLayout={(event) => setFloatHeight(event.nativeEvent.layout.height)}
        testID="composer-float">
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
                {parent ? (parent.rich ? richLabel(t, parent.rich) : bodyPreview(parent.body) || t('list.files', { count: parent.attachments.length })) : ''}
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
                uri={file.uri}
                onRemove={() => {
                  dropFile(file.uri);
                  setFiles((current) => current.filter((_, position) => position !== index));
                }}
              />
            ))}
          </ScrollView>
        ) : null}
        {voice.state.phase === 'paused' ? <InterruptionBanner reason={voice.state.reason} /> : null}
        <View style={styles.row} testID="composer-row">
          {voicePhase ? (
            <Animated.View key="voice" style={styles.group} entering={voiceIn} exiting={groupOut}>
              <GlassCapsule liquid thickness="thick" solid={solidCapsule} style={styles.capsule} testID="composer-voice-capsule">
                <VoiceRow voice={voice} channelId={channelId} />
              </GlassCapsule>
            </Animated.View>
          ) : (
            <Animated.View key="compose" style={styles.group} entering={composeIn} exiting={groupOut}>
              <GlassCapsule liquid thickness="thick" solid={solidCapsule} style={styles.capsule} testID="composer-capsule">
                {editing ? null : <RoundButton ref={attachButton} icon="attach" label={t('composer.attach')} inCapsule onPress={() => setSheet(true)} testID="composer-attach" />}
                <View style={[styles.field, editing && styles.fieldAlone]} testID="composer-field">
                  <TextInput
                    ref={input}
                    value={text}
                    onChangeText={changeText}
                    onSelectionChange={(event: TextInputSelectionChangeEvent) => {
                      setCursor(event.nativeEvent.selection.end);
                      markup.inputProps.onSelectionChange(event);
                    }}
                    onFocus={() => {
                      if (panel && keyboardVisible) {
                        reopening.current = false;
                        setSearching(false);
                        open.set(0);
                        setPanel(false);
                      } else if (panel) reopening.current = true;
                      markup.inputProps.onFocus();
                    }}
                    onBlur={markup.inputProps.onBlur}
                    placeholder={t('composer.placeholder')}
                    placeholderTextColor={colors.inkSoft}
                    multiline
                    disableFullscreenUI
                    submitBehavior={hardwareSubmit ? 'submit' : 'newline'}
                    returnKeyType={hardwareSubmit ? 'send' : 'default'}
                    onSubmitEditing={hardwareSubmit ? submit : undefined}
                    accessibilityLabel={t('composer.placeholder')}
                    testID="composer-input"
                    style={[styles.input, { color: colors.ink }]}
                  />
                  <FieldButton
                    icon={panel ? 'keyboard' : 'emoji'}
                    label={panel ? t('composer.showKeyboard') : t('composer.openPanel')}
                    onPress={panel ? showKeyboard : openPanel}
                    testID={panel ? 'composer-keyboard' : 'composer-panel-toggle'}
                  />
                </View>
                {editing ? null : <CameraSlot shown={mode === 'mic'} onPress={() => void pickFrom('camera')} onLongPress={() => void pickFrom('photos')} />}
              </GlassCapsule>
            </Animated.View>
          )}
          {discarding ? <DiscardAnimation onDone={endDiscard} /> : null}
          {editing ? (
            <RoundButton icon="check" label={t('composer.saveEdit')} filled inRow onPress={submit} testID="composer-save-edit" />
          ) : (
            <SendMicButton mode={mode} voice={voice} tapMode={tapMode} onSend={submit} />
          )}
          {editing ? null : <LockPill voice={voice} />}
          {editing ? null : <ShortHint shown={voice.hint} />}
        </View>
        {markup.showBar && !voicePhase ? (
          <FormatBar
            onApply={markup.apply}
            onSpace={(height) => {
              formatBarSpace.current = height;
            }}
          />
        ) : null}
      </View>
      {panelKept ? (
        <Animated.View
          pointerEvents={panel ? 'auto' : 'none'}
          importantForAccessibility={hideWhen(!panel || sheet)}
          accessibilityElementsHidden={!panel}
          style={[styles.panelClip, panelStyle]}
          testID="composer-panel-clip">
          <View style={{ height: target }} testID={panel ? 'composer-panel-box' : undefined}>
            <ComposerPanel
              shown={panel}
              origin={origin}
              full={full}
              searching={searching}
              onSize={sizePanel}
              onEmoji={(emoji) => insertAtCursor(emoji)}
              onBackspace={backspace}
              onSticker={(sticker: Sticker) => sendRich({ sticker })}
              onGif={(gif: GifMedia) => sendRich({ gif })}
              onSearching={setSearching}
            />
          </View>
        </Animated.View>
      ) : null}
      <AttachSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onPick={(source) => void pickFrom(source)}
        returnFocus={attachButton}
        extras={extras}
        tools={
          editing
            ? []
            : [
                { key: 'location', icon: 'location', label: t('composer.source.location'), onPress: () => { setSheet(false); setExtra('location'); } },
                { key: 'poll', icon: 'poll', label: t('composer.source.poll'), onPress: () => { setSheet(false); setExtra('poll'); } },
              ]
        }
      />
      {extra === 'poll' ? <PollSheet onClose={() => setExtra(null)} onSend={(poll) => { setExtra(null); sendRich({ poll }); }} /> : null}
      {extra === 'location' ? <LocationPicker onClose={() => setExtra(null)} onSend={(location) => { setExtra(null); sendRich({ location }); }} /> : null}
      {extra === 'later' ? <SendLaterSheet busy={laterBusy} onClose={() => setExtra(null)} onPick={(when) => void scheduleAt(when)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '600' },
  container: { paddingTop: space.sm, paddingHorizontal: space.sm, gap: space.sm },
  float: { gap: space.sm },
  capsule: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: pill.composer.height, borderRadius: pill.composer.height / 2, borderWidth: glassEdge, borderColor: 'transparent' },
  fieldAlone: { paddingLeft: pill.composer.inset },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: controlGap },
  group: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: controlGap },
  panelClip: { overflow: 'hidden', marginHorizontal: -space.sm },
  round: { width: touchTarget, height: touchTarget, borderRadius: touchTarget / 2, alignItems: 'center', justifyContent: 'center' },
  rowButton: { width: pill.composer.button, height: pill.composer.button, borderRadius: pill.composer.button / 2 },
  capsuleButton: { width: pill.composer.inside, height: pill.composer.inside, borderRadius: pill.composer.inside / 2 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: pill.composer.inside },
  input: { flex: 1, fontSize: 16, lineHeight: inputLine, maxHeight: 132, minHeight: pill.composer.inside, textAlignVertical: 'bottom', paddingTop: (pill.composer.inside - inputLine) / 2, paddingBottom: (pill.composer.inside - inputLine) / 2 },
  suggestions: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.sm, paddingLeft: space.md },
  staged: { gap: space.sm },
});
