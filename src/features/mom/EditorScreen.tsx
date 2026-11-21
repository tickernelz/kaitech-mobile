import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { invalidate, useResource } from '../../api/resource';
import type { Account } from '../../auth/oauth';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { StateView, useErrorText } from '../discovery/ui';
import {
  correct,
  editor,
  findDoubts,
  openTranscriptFile,
  relabel,
  restore,
  segmentFilters,
  setFlag,
  takeElevenLabs,
  takeElevenLabsWhereDifferent,
  visibleSegments,
  type EditorSegment,
  type EditorView,
  type RelabelScope,
  type SegmentFilter,
} from './editor';
import { ChoiceRow } from './followupParts';
import { MoreSheet, type MoreAction } from './MoreSheet';
import { SmallButton } from './parts';
import { PlayerBar, usePlayback } from './playback';

const pageSize = 150;
const settleMs = 300;

export function editorKey(recording: number) {
  return `mom.editor.${recording}`;
}

export function useEditorRun(recording: number) {
  const { active } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState('');
  return {
    busy,
    run: async (name: string, work: (account: Account) => Promise<unknown>, done?: string) => {
      if (!active || busy) return false;
      setBusy(name);
      try {
        await work(active);
        invalidate(`${active.id}:${editorKey(recording)}`);
        invalidate(`${active.id}:mom.transcript.${recording}`);
        if (done) Alert.alert('', done);
        return true;
      } catch (error) {
        Alert.alert('', errorText(error));
        return false;
      } finally {
        setBusy('');
      }
    },
  };
}

export function EditorScreen({ recording }: { recording: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const view = useResource(editorKey(recording), (account) => editor(account, recording), 60_000);
  const playback = usePlayback(recording);
  const action = useEditorRun(recording);
  const { active } = useSession();
  const [filter, setFilter] = useState<SegmentFilter>('all');
  const [speaker, setSpeaker] = useState('');
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const [chosen, setChosen] = useState<EditorSegment | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), settleMs);
    return () => clearTimeout(timer);
  }, [typed]);
  const data = view.data;
  if (!data) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="mom-editor">
        <Header title={t('mom.editor.title')} />
        <StateView loading={!view.error} error={view.error} onRetry={() => void view.refresh()} testID="editor" />
      </SafeAreaView>
    );
  }
  const editable = data.canChange && !data.settled;
  const shown = visibleSegments(data.segments, filter, speaker, search);
  const counts = Object.fromEntries(segmentFilters.map((one) => [one, visibleSegments(data.segments, one, '', '').length]));
  const open = (path: 'speakers' | 'doubts') => router.push({ pathname: `/mom/transcript/${path}`, params: { recording: String(recording) } });
  const download = (kind: 'txt' | 'docx', version: 'corrected' | 'elevenlabs') => () =>
    void action.run(`download-${kind}-${version}`, async (account) => {
      const { file, name, mimeType } = await openTranscriptFile(account, recording, kind, version);
      if (await file.canPreview({ mimeType })) await file.preview({ mimeType, title: name });
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
    });
  const tools: MoreAction[] = [
    { key: 'speakers', icon: 'people', label: t('mom.editor.speakers', { count: data.speakers.length }), onPress: () => open('speakers') },
    { key: 'doubts', icon: 'bulb', label: t('mom.editor.doubts', { count: data.doubts.length }), onPress: () => open('doubts') },
    ...(editable && data.hasElevenLabs
      ? [
          {
            key: 'elevenAll',
            icon: 'compass' as const,
            label: t('mom.editor.elevenAll'),
            onPress: () => void action.run('elevenAll', (account) => takeElevenLabsWhereDifferent(account, recording)),
          },
        ]
      : []),
    ...(editable ? [{ key: 'findDoubts', icon: 'search' as const, label: t('mom.editor.findDoubts'), onPress: () => void action.run('findDoubts', (account) => findDoubts(account, recording), t('mom.editor.findStarted')) }] : []),
  ];
  const files: MoreAction[] = [
    { key: 'txt', icon: 'download', label: t('mom.editor.downloadTxt'), onPress: download('txt', 'corrected') },
    { key: 'docx', icon: 'download', label: t('mom.editor.downloadDocx'), onPress: download('docx', 'corrected') },
    ...(data.hasElevenLabs ? [{ key: 'elevenTxt', icon: 'download' as const, label: t('mom.editor.downloadEleven'), onPress: download('txt', 'elevenlabs') }] : []),
  ];

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="mom-editor">
      <Header
        title={data.recording.name}
        subtitle={t('mom.editor.title')}
        actions={<IconButton icon="more" label={t('mom.menu.title')} onPress={() => setMoreOpen(true)} testID="editor-more" />}
      />
      <FlatList
        data={shown.slice(0, limit)}
        keyExtractor={(segment) => String(segment.id)}
        contentContainerStyle={styles.content}
        initialNumToRender={20}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={view.loading} onRefresh={() => void view.refresh()} />}
        ListHeaderComponent={
          <View style={styles.top}>
            {data.settled ? (
              <View style={[styles.note, { backgroundColor: colors.surface2 }]}>
                <Text variant="callout">{data.settled}</Text>
              </View>
            ) : null}
            {data.check.label ? (
              <Text variant="footnote" tone="inkSoft">
                {[data.check.label, data.check.note].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <ChoiceRow
              options={segmentFilters.map((one) => ({ value: one, label: `${t(`mom.editor.filters.${one}`)} ${counts[one]}` }))}
              value={filter}
              onChange={(next) => {
                setFilter(next);
                setLimit(pageSize);
              }}
              testID="editor-filter"
            />
            {data.speakers.length > 1 ? (
              <ChoiceRow
                options={[{ value: '', label: t('mom.editor.everyone') }, ...data.speakers.map((one) => ({ value: one.label, label: one.person || one.label }))]}
                value={speaker}
                onChange={setSpeaker}
                testID="editor-speaker"
              />
            ) : null}
            <TextField label={t('mom.records.search')} value={typed} onChangeText={setTyped} autoCorrect={false} testID="editor-search" />
          </View>
        }
        ListEmptyComponent={<Text tone="inkSoft">{t('mom.editor.none')}</Text>}
        ListFooterComponent={shown.length > limit ? <SmallButton label={t('mom.more')} onPress={() => setLimit((count) => count + pageSize)} testID="editor-page" /> : undefined}
        renderItem={({ item }) => <SegmentRow segment={item} onPress={() => setChosen(item)} />}
        testID="editor-list"
      />
      {active ? <PlayerBar playback={playback} skip /> : null}
      {chosen ? (
        <SegmentSheet
          segment={chosen}
          view={data}
          editable={editable}
          onPlay={() => void playback.play(chosen.start)}
          onClose={() => setChosen(null)}
        />
      ) : null}
      {moreOpen ? (
        <MoreSheet
          title={t('mom.menu.title')}
          groups={[
            { key: 'tools', actions: tools },
            { key: 'files', title: t('mom.finalTools.menu.filesGroup'), actions: files },
          ]}
          onClose={() => setMoreOpen(false)}
          testID="editor-more-sheet"
        />
      ) : null}
    </SafeAreaView>
  );
}

function SegmentRow({ segment, onPress }: { segment: EditorSegment; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const marks = [
    segment.flagged ? t('mom.editor.marks.flagged') : '',
    segment.corrected ? t('mom.editor.marks.corrected') : '',
    segment.speakerChanged ? t('mom.editor.marks.speaker') : '',
    segment.verdict === 'divergent' ? segment.verdictLabel || t('mom.editor.marks.different') : '',
    segment.doubts.length ? t('mom.editor.marks.doubts', { count: segment.doubts.length }) : '',
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t('mom.editor.rowHint')}
      onPress={onPress}
      style={({ pressed }) => [styles.segment, pressed && { backgroundColor: colors.surface2 }]}
      testID={`editor-segment-${segment.id}`}>
      <Text variant="footnote" tone="inkSoft" style={styles.mono}>
        {segment.clock}
      </Text>
      <View style={styles.flex}>
        <Text variant="label" tone="selectInk">
          {segment.person ? `${segment.person} (${segment.speaker})` : segment.speaker}
        </Text>
        <Text>{segment.text}</Text>
        {marks.length ? (
          <Text variant="footnote" tone="inkSoft">
            {marks.join(' · ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type Page = 'menu' | 'text' | 'speaker';

function SegmentSheet({ segment, view, editable, onPlay, onClose }: { segment: EditorSegment; view: EditorView; editable: boolean; onPlay: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const action = useEditorRun(view.recording.id);
  const [page, setPage] = useState<Page>('menu');
  const [text, setText] = useState(segment.text);
  const [label, setLabel] = useState(segment.speaker);
  const [scope, setScope] = useState<RelabelScope>('segment');
  const done = (ok: boolean) => ok && onClose();
  const items: { key: string; label: string; onPress: () => void }[] = [
    {
      key: 'play',
      label: t('mom.editor.playHere'),
      onPress: () => {
        onPlay();
        onClose();
      },
    },
    ...(editable
      ? [
          { key: 'text', label: t('mom.editor.editText'), onPress: () => setPage('text') },
          { key: 'speaker', label: t('mom.editor.changeSpeaker'), onPress: () => setPage('speaker') },
          {
            key: 'flag',
            label: t(segment.flagged ? 'mom.editor.unflag' : 'mom.editor.flag'),
            onPress: () => void action.run('flag', (account) => setFlag(account, segment.id, !segment.flagged)).then(done),
          },
          ...(segment.corrected
            ? [{ key: 'restore', label: t('mom.editor.restore'), onPress: () => void action.run('restore', (account) => restore(account, segment.id)).then(done) }]
            : []),
          ...(segment.altText && segment.altText !== segment.text
            ? [{ key: 'eleven', label: t('mom.editor.useEleven'), onPress: () => void action.run('eleven', (account) => takeElevenLabs(account, segment.id)).then(done) }]
            : []),
        ]
      : []),
  ];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={page === 'menu' ? onClose : () => setPage('menu')} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('mom.menu.close')}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => undefined} accessibilityViewIsModal testID="segment-sheet">
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text variant="footnote" tone="inkSoft">
              {[segment.clock, segment.person || segment.speaker].join(' · ')}
            </Text>
            <Text>{segment.text}</Text>
            {segment.text !== segment.transcribedText && segment.transcribedText ? (
              <Text variant="footnote" tone="inkSoft">
                {t('mom.editor.heard', { text: segment.transcribedText })}
              </Text>
            ) : null}
            {segment.altText && segment.altText !== segment.text ? (
              <Text variant="footnote" tone="inkSoft">
                {t('mom.editor.elevenSaid', { text: segment.altText })}
              </Text>
            ) : null}
            {segment.reason ? (
              <Text variant="footnote" tone="inkSoft">
                {segment.reason}
              </Text>
            ) : null}
            {page === 'menu'
              ? items.map((item) => (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    onPress={item.onPress}
                    style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface2 }]}
                    testID={`segment-${item.key}`}>
                    <Text>{item.label}</Text>
                  </Pressable>
                ))
              : null}
            {page === 'text' ? (
              <>
                <TextField label={t('mom.editor.editText')} value={text} onChangeText={setText} multiline autoFocus testID="segment-text" />
                <Button
                  label={t('mom.followups.save')}
                  disabled={!text.trim() || text === segment.text}
                  busy={action.busy === 'text'}
                  onPress={() => void action.run('text', (account) => correct(account, segment.id, text.trim())).then(done)}
                  testID="segment-save"
                />
              </>
            ) : null}
            {page === 'speaker' ? (
              <>
                <ChoiceRow options={view.speakers.map((one) => ({ value: one.label, label: one.person || one.label }))} value={label} onChange={setLabel} testID="segment-label" />
                <TextField label={t('mom.editor.newLabel')} value={label} onChangeText={setLabel} autoCorrect={false} testID="segment-label-text" />
                <ChoiceRow
                  options={(['segment', 'from', 'until'] as const).map((value) => ({ value, label: t(`mom.editor.scope.${value}`) }))}
                  value={scope}
                  onChange={setScope}
                  testID="segment-scope"
                />
                <Button
                  label={t('mom.followups.save')}
                  disabled={!label.trim() || (label.trim() === segment.speaker && scope === 'segment')}
                  busy={action.busy === 'speaker'}
                  onPress={() => void action.run('speaker', (account) => relabel(account, view.recording.id, segment.id, label, scope)).then(done)}
                  testID="segment-relabel"
                />
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  mono: { fontVariant: ['tabular-nums'], width: 56 },
  top: { gap: space.sm, paddingBottom: space.md },
  note: { padding: space.md, borderRadius: radius.md },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  segment: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderRadius: radius.md },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '85%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg },
  sheetBody: { gap: space.sm, paddingBottom: space.sm },
  item: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.md },
});
