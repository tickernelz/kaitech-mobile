import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type GestureResponderEvent, type TextInputSelectionChangeEvent } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowClass } from '../../../layout/windowClass';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { chatClient, notifyTyping, send, type Outgoing } from '../chat';
import { clearDraft, readDraft, writeDraft } from '../drafts';
import { adoptFile, dropFile, stageFile } from '../files';
import { plainText } from '../html';
import { askForPushOnce } from '../push';
import type { Mention, Message } from '../types';
import { stopVoice } from '../voicePlayer';
import { Avatar } from './Avatar';
import { useChatFormat } from './format';
import { Icon, type IconName } from './icons';

type Staged = Outgoing['files'][number];

export type ComposerHandle = { reply(message: Message): void; focus(): void };

const sources = ['camera', 'photos', 'files'] as const;
const cancelDistance = 96;
const now = () => Date.now();
const clock = () => performance.now();
const shortestVoiceMs = 800;

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

type Recording = { started: number; elapsed: number; offset: number };

export const Composer = forwardRef<ComposerHandle, { accountId: string; channelId: number; messages: Message[]; onSent: () => void }>(function Composer(
  { accountId, channelId, messages, onSent },
  ref,
) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const { windowClass } = useWindowClass();
  const { duration } = useChatFormat();
  const [initial] = useState(() => readDraft(accountId, channelId));
  const [text, setText] = useState(initial.text);
  const [mentions, setMentions] = useState<Mention[]>(initial.mentions);
  const [parentId, setParentId] = useState<number | null>(initial.parentId);
  const [files, setFiles] = useState<Staged[]>([]);
  const [cursor, setCursor] = useState(initial.text.length);
  const [suggestions, setSuggestions] = useState<Mention[]>([]);
  const [sheet, setSheet] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const typingAt = useRef(0);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recordingRef = useRef<Recording | null>(null);
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);
  const hardwareSubmit = windowClass !== 'compact';
  const parent = parentId ? messages.find((message) => message.id === parentId) : null;

  useImperativeHandle(ref, () => ({
    reply: (message) => {
      setParentId(message.id);
      input.current?.focus();
    },
    focus: () => input.current?.focus(),
  }));

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

  const addPicked = (picked: { uri: string; name: string; mimeType: string }[]) => {
    const staged: Staged[] = [];
    for (const item of picked) {
      try {
        const copy = stageFile(item.uri, item.name);
        staged.push({ uri: copy.uri, name: item.name, mimetype: item.mimeType, size: copy.size, voice: false, durationMs: null });
      } catch {
        Alert.alert(t('composer.fileFailed', { name: item.name }));
      }
    }
    setFiles((current) => [...current, ...staged]);
  };

  const deniedAlert = (what: 'camera' | 'microphone') => {
    Alert.alert(t(`permissions.${what}Title`), t(`permissions.${what}Body`), [
      { text: t('permissions.cancel'), style: 'cancel' },
      { text: t('permissions.openSettings'), onPress: () => void Linking.openSettings() },
    ]);
  };

  const mediaName = (asset: ImagePicker.ImagePickerAsset, index: number, prefix: string) =>
    asset.fileName ?? `${prefix}-${now()}-${index}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
  const mediaType = (asset: ImagePicker.ImagePickerAsset) => asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

  const pickFrom = async (source: 'camera' | 'photos' | 'files') => {
    setSheet(false);
    if (source === 'files') {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (!result.canceled) addPicked(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' })));
      return;
    }
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return deniedAlert('camera');
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
      if (!result.canceled) addPicked(result.assets.map((asset, index) => ({ uri: asset.uri, name: mediaName(asset, index, 'camera'), mimeType: mediaType(asset) })));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) addPicked(result.assets.map((asset, index) => ({ uri: asset.uri, name: mediaName(asset, index, 'media'), mimeType: mediaType(asset) })));
  };

  const startRecording = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) deniedAlert('microphone');
      return;
    }
    stopVoice();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecording({ started: now(), elapsed: 0, offset: 0 });
  };

  const recordingActive = recording !== null;
  useEffect(() => {
    if (!recordingActive) return;
    const timer = setInterval(() => setRecording((current) => (current ? { ...current, elapsed: now() - current.started } : current)), 250);
    return () => clearInterval(timer);
  }, [recordingActive]);

  const finishRecording = async (cancel: boolean) => {
    const current = recordingRef.current;
    if (!current) return;
    setRecording(null);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    const elapsed = now() - current.started;
    if (!uri) return;
    if (cancel || elapsed < shortestVoiceMs) {
      dropFile(uri);
      if (!cancel) Alert.alert(t('composer.holdToRecord'));
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const name = `voice-${new Date(current.started).toISOString().replace(/[:.]/g, '-')}.m4a`;
    const kept = adoptFile(uri, name);
    const startedAt = clock();
    const voice: Staged = { uri: kept.uri, name, mimetype: 'audio/mp4', size: kept.size, voice: true, durationMs: elapsed };
    const replyTo = parentId;
    if (replyTo) setParentId(null);
    delivered(await send({ channelId, text: '', parentId: replyTo, mentions: [], files: [voice] }, startedAt));
  };

  const starting = useRef<Promise<void> | null>(null);
  const touch = useRef({ x: 0, dx: 0 });
  const hold = {
    onTouchStart: (event: GestureResponderEvent) => {
      touch.current = { x: event.nativeEvent.pageX, dx: 0 };
      starting.current = startRecording().finally(() => {
        starting.current = null;
      });
    },
    onTouchMove: (event: GestureResponderEvent) => {
      const dx = Math.min(0, event.nativeEvent.pageX - touch.current.x);
      touch.current.dx = dx;
      setRecording((current) => (current ? { ...current, offset: dx } : current));
    },
    onTouchEnd: () => {
      const cancel = touch.current.dx < -cancelDistance;
      void (starting.current ?? Promise.resolve()).then(() => finishRecording(cancel));
    },
    onTouchCancel: () => {
      void (starting.current ?? Promise.resolve()).then(() => finishRecording(true));
    },
  };

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
        <View style={[styles.replyBar, { backgroundColor: colors.surface2, borderColor: colors.primary }]} testID="composer-reply">
          <View style={styles.flex}>
            <Text variant="footnote" style={[styles.strong, { color: colors.primary }]}>
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
            <View key={file.uri} style={[styles.stagedFile, { backgroundColor: colors.surface2 }]}>
              <Icon name={file.mimetype.startsWith('image/') ? 'image' : 'file'} size={18} color={colors.inkSoft} />
              <Text variant="footnote" numberOfLines={1} style={styles.stagedName}>
                {file.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('composer.removeFile', { name: file.name })}
                hitSlop={12}
                onPress={() => {
                  dropFile(file.uri);
                  setFiles((current) => current.filter((_, position) => position !== index));
                }}>
                <Icon name="close" size={18} color={colors.inkSoft} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.row}>
        {recording ? (
          <View style={[styles.flex, styles.recording]} accessibilityLiveRegion="polite" testID="voice-recording">
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text variant="headline">{duration(recording.elapsed)}</Text>
            <Text
              variant="callout"
              tone={recording.offset < -cancelDistance ? 'dangerInk' : 'inkSoft'}
              style={[styles.flex, { transform: [{ translateX: recording.offset / 3 }] }]}
              numberOfLines={1}>
              {recording.offset < -cancelDistance ? t('composer.releaseToCancel') : t('composer.slideToCancel')}
            </Text>
          </View>
        ) : (
          <>
            <RoundButton icon="plus" label={t('composer.attach')} onPress={() => setSheet(true)} testID="composer-attach" />
            <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <TextInput
                ref={input}
                value={text}
                onChangeText={changeText}
                onSelectionChange={(event: TextInputSelectionChangeEvent) => setCursor(event.nativeEvent.selection.end)}
                placeholder={t('composer.placeholder')}
                placeholderTextColor={colors.inkFaint}
                multiline
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
        <View
          accessible={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t('composer.recordVoice')}
          accessibilityHint={t('composer.holdToRecord')}
          importantForAccessibility={canSend ? 'no-hide-descendants' : 'auto'}
          testID="composer-mic"
          style={[canSend ? styles.hidden : recording ? styles.recordButton : styles.round, { backgroundColor: recording ? colors.danger : colors.primary }]}
          {...hold}>
          <Icon name="mic" color={recording ? colors.surface : colors.onPrimary} />
        </View>
      </View>
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)} supportedOrientations={['portrait', 'landscape']}>
        <Pressable style={styles.scrim} onPress={() => setSheet(false)} accessibilityLabel={t('composer.closeSheet')} accessibilityRole="button">
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]} accessibilityViewIsModal onPress={() => undefined}>
            <Text variant="title" accessibilityRole="header">
              {t('composer.attachTitle')}
            </Text>
            <View style={styles.sheetGrid}>
              {sources.map((source) => (
                <Pressable key={source} accessibilityRole="button" onPress={() => void pickFrom(source)} style={styles.sheetItem} testID={`attach-${source}`}>
                  <View style={[styles.sheetIcon, { backgroundColor: colors.select }]}>
                    <Icon name={source === 'camera' ? 'camera' : source === 'photos' ? 'image' : 'file'} color={colors.selectInk} />
                  </View>
                  <Text variant="callout" style={styles.centerText}>
                    {t(`composer.source.${source}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '600' },
  centerText: { textAlign: 'center' },
  container: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, paddingHorizontal: space.sm, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  recording: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingLeft: space.md, gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hidden: { width: 0, height: 44, overflow: 'hidden', opacity: 0 },
  recordButton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, justifyContent: 'center' },
  input: { fontSize: 16, lineHeight: 22, maxHeight: 132, paddingTop: Platform.OS === 'ios' ? 11 : 8, paddingBottom: Platform.OS === 'ios' ? 11 : 8 },
  suggestions: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderLeftWidth: 3, borderRadius: radius.sm, paddingLeft: space.sm },
  staged: { gap: space.sm },
  stagedFile: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, minHeight: 40, borderRadius: radius.md, maxWidth: 240 },
  stagedName: { flexShrink: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(17,5,27,0.45)' },
  sheet: { width: '100%', maxWidth: 560, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xl, gap: space.lg },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  sheetItem: { width: 88, alignItems: 'center', gap: space.xs },
  sheetIcon: { width: 56, height: 56, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
});
