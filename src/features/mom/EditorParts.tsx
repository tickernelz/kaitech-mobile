import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { readableWidth } from '../../layout/windowClass';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Check, Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { Card, StateView } from '../discovery/ui';
import { applyDoubts, editor, mapSpeakers, setSpeakerPerson, settleDoubt, speakerMappings, undoRelabel, validateSpeaker, type EditorSpeaker, type EditorView } from './editor';
import { editorKey, useEditorRun } from './EditorScreen';
import { MoreSheet } from './MoreSheet';
import { SmallButton } from './parts';
import { PlayerBar, usePlayback } from './playback';

function Shell({ recording, part, children }: { recording: number; part: 'speakers' | 'doubts'; children: (view: EditorView) => ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const view = useResource(editorKey(recording), (account) => editor(account, recording), 60_000);
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={`editor-${part}`}>
      <Header title={t(`mom.editor.${part}Title`)} subtitle={view.data?.recording.name} />
      {view.data ? children(view.data) : <StateView loading={!view.error} error={view.error} onRetry={() => void view.refresh()} testID={`editor-${part}`} />}
    </SafeAreaView>
  );
}

export function SpeakersScreen({ recording }: { recording: number }) {
  return <Shell recording={recording} part="speakers">{(view) => <Speakers view={view} />}</Shell>;
}

function Speakers({ view }: { view: EditorView }) {
  const { t } = useTranslation();
  const playback = usePlayback(view.recording.id);
  const action = useEditorRun(view.recording.id);
  const [picking, setPicking] = useState<EditorSpeaker | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const editable = view.canChange && !view.settled;
  const mappings = speakerMappings(
    view.speakers.map((one) => one.label),
    names,
  );
  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {view.speakers.length ? null : <StateView empty={{ title: t('mom.editor.noSpeakers'), icon: 'people' }} />}
        {view.speakers.map((speaker) => (
          <Card key={speaker.id} testID={`speaker-${speaker.id}`}>
            <Text variant="headline">{speaker.person || speaker.label}</Text>
            <Text variant="footnote" tone="inkSoft">
              {[speaker.label, t('mom.editor.speakerLine', { segments: speaker.segments, minutes: Math.round(speaker.seconds / 60) }), speaker.validated ? t('mom.editor.validatedBy', { name: speaker.validatedBy }) : '']
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View style={styles.row}>
              {speaker.first !== false ? <SmallButton label={t('mom.editor.sample')} onPress={() => void playback.play(speaker.first as number)} testID={`speaker-play-${speaker.id}`} /> : null}
              {editable ? (
                <>
                  <SmallButton label={t('mom.editor.person')} onPress={() => setPicking(speaker)} testID={`speaker-person-${speaker.id}`} />
                  <SmallButton
                    label={t(speaker.validated ? 'mom.editor.unvalidate' : 'mom.editor.validate')}
                    onPress={() => void action.run(`valid-${speaker.id}`, (account) => validateSpeaker(account, speaker.id, !speaker.validated))}
                    testID={`speaker-validate-${speaker.id}`}
                  />
                </>
              ) : null}
            </View>
            {editable ? (
              <TextField
                label={t('mom.editor.renameTo')}
                value={names[speaker.label] ?? speaker.label}
                onChangeText={(next) => setNames((current) => ({ ...current, [speaker.label]: next }))}
                autoCorrect={false}
                testID={`speaker-rename-${speaker.id}`}
              />
            ) : null}
          </Card>
        ))}
        {editable && view.speakers.length ? (
          <Button
            label={t('mom.editor.mapSave', { count: mappings.length })}
            disabled={!mappings.length}
            busy={action.busy === 'map'}
            onPress={() => void action.run('map', (account) => mapSpeakers(account, view.recording.id, mappings)).then((ok) => ok && setNames({}))}
            testID="speakers-map"
          />
        ) : null}
        {view.history.length ? (
          <Section title={t('mom.editor.history')}>
            {view.history.map((entry) => (
              <Row
                key={entry.id}
                title={entry.said}
                detail={[t('mom.editor.historyLine', { count: entry.count }), entry.by, entry.undone ? t('mom.editor.undone') : ''].filter(Boolean).join(' · ')}
                trailing={editable && !entry.undone ? <SmallButton label={t('mom.editor.undo')} onPress={() => void action.run(`undo-${entry.id}`, (account) => undoRelabel(account, entry.id))} testID={`relabel-undo-${entry.id}`} /> : undefined}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>
      <PlayerBar playback={playback} skip />
      {picking ? (
        <MoreSheet
          title={t('mom.editor.person')}
          groups={[
            {
              key: 'people',
              actions: [
                ...view.people.map((one) => ({
                  key: `person-${one.id}`,
                  icon: 'people' as const,
                  label: one.name,
                  detail: one.title,
                  onPress: () => void action.run('person', (account) => setSpeakerPerson(account, picking.id, one.id)),
                })),
                ...(picking.profileId ? [{ key: 'person-none', icon: 'close' as const, label: t('mom.editor.noPerson'), onPress: () => void action.run('person', (account) => setSpeakerPerson(account, picking.id, false)) }] : []),
              ],
            },
          ]}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </>
  );
}

export function DoubtsScreen({ recording }: { recording: number }) {
  return <Shell recording={recording} part="doubts">{(view) => <Doubts view={view} />}</Shell>;
}

function Doubts({ view }: { view: EditorView }) {
  const { t } = useTranslation();
  const action = useEditorRun(view.recording.id);
  const [chosen, setChosen] = useState<number[]>([]);
  const editable = view.canChange && !view.settled;
  if (!view.doubts.length) return <StateView empty={{ title: t('mom.editor.noDoubts'), icon: 'bulb' }} />;
  const toggle = (id: number) => setChosen((list) => (list.includes(id) ? list.filter((one) => one !== id) : [...list, id]));
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {view.doubts.map((doubt) => (
        <Card key={doubt.id} testID={`doubt-${doubt.id}`}>
          <Text variant="footnote" tone="inkSoft">
            {[doubt.clock, doubt.speaker, typeof doubt.confidence === 'number' ? t('mom.itemExtra.confidence', { value: Math.round(doubt.confidence * 100) }) : '', doubt.source]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text>{t('mom.editor.heardMeant', { heard: doubt.heard, meant: doubt.meant })}</Text>
          {doubt.reason ? (
            <Text variant="footnote" tone="inkSoft">
              {doubt.reason}
            </Text>
          ) : null}
          {!doubt.fits ? (
            <Text variant="footnote" tone="warnInk">
              {t('mom.editor.doesNotFit')}
            </Text>
          ) : null}
          {editable ? (
            <View style={styles.row}>
              <Row title={t('mom.editor.choose')} trailing={<Check visible={chosen.includes(doubt.id)} />} selected={chosen.includes(doubt.id)} onPress={() => toggle(doubt.id)} testID={`doubt-choose-${doubt.id}`} />
              <SmallButton label={t('mom.finalTools.apply')} onPress={() => void action.run(`apply-${doubt.id}`, (account) => settleDoubt(account, doubt.id, true))} testID={`doubt-apply-${doubt.id}`} />
              <SmallButton label={t('mom.editor.reject')} onPress={() => void action.run(`reject-${doubt.id}`, (account) => settleDoubt(account, doubt.id, false))} testID={`doubt-reject-${doubt.id}`} />
            </View>
          ) : null}
        </Card>
      ))}
      {editable ? (
        <Button
          label={t('mom.editor.applyChosen', { count: chosen.length })}
          disabled={!chosen.length}
          busy={action.busy === 'applyChosen'}
          onPress={() => void action.run('applyChosen', (account) => applyDoubts(account, view.recording.id, chosen)).then((ok) => ok && setChosen([]))}
          testID="doubts-apply-chosen"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
