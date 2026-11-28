import { useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { useResource } from '../../api/resource';
import { readableWidth, useWindowClass } from '../../layout/windowClass';
import { radius, space, stroke, useTheme } from '../../theme';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { Header } from '../discovery/Header';
import { Card, Chip, Segmented, StateView } from '../discovery/ui';
import { minutesDetail, secondsOf, transcript, type Detail, type Item } from './api';
import { FinalPanel } from './FinalPanel';
import { MeetingMenu } from './MeetingMenu';
import { filterItems, type ItemFilter } from './minutes';
import { ItemExtra, ItemFilters, MinutesBar, MinutesLinks } from './MinutesExtras';
import { MeetingChip, SmallButton, useMomFormat } from './parts';
import { PlayerBar, usePlayback } from './playback';
import { useRecording } from './recorder';
import { Refresh } from '../../ui/Refresh';

type Tab = 'notes' | 'items' | 'transcript' | 'final';

const shortWindow = 520;

function Banner({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: colors.warnBand }]}>
      <Text variant="callout" tone="warnInk">
        {text}
      </Text>
    </View>
  );
}

function Bullets({ title, lines }: { title: string; lines?: string[] }) {
  if (!lines?.length) return null;
  return (
    <Section title={title}>
      {lines.map((line, index) => (
        <View key={index} style={styles.bullet}>
          <Text>{line}</Text>
        </View>
      ))}
    </Section>
  );
}

function Notes({ detail }: { detail: Detail }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const summary = detail.summary ?? {};
  const decisions = summary.keputusan ?? [];
  const actions = summary.action_items ?? [];
  return (
    <>
      <Banner text={t('mom.detail.unverified')} />
      {summary.summary || summary.ringkasan ? (
        <View style={styles.block}>
          <Text variant="title" accessibilityRole="header">
            {t('mom.detail.summary')}
          </Text>
          <Text selectable>{summary.summary || summary.ringkasan}</Text>
        </View>
      ) : null}
      {decisions.length || actions.length ? (
        <Section title={t('mom.detail.decisions')}>
          {decisions.map((line, index) => (
            <View key={`k${index}`} style={styles.entry} testID={`decision-${index}`}>
              <View style={[styles.badge, { backgroundColor: colors.select }]}>
                <Text variant="label" tone="selectInk">{`K${index + 1}`}</Text>
              </View>
              <View style={styles.entryText}>
                <Text variant="callout">{line}</Text>
                <Chip tone="ok" label={t('mom.detail.decision')} />
              </View>
            </View>
          ))}
          {actions.map((action, index) => (
            <View key={`t${index}`} style={styles.entry} testID={`task-${index}`}>
              <View style={[styles.badge, { backgroundColor: colors.select }]}>
                <Text variant="label" tone="selectInk">{`T${index + 1}`}</Text>
              </View>
              <View style={styles.entryText}>
                <Text variant="callout">{action.task}</Text>
                <Text variant="footnote" tone="inkSoft">
                  {[action.owner, action.due ? t('mom.detail.due', { due: action.due }) : ''].filter(Boolean).join(' · ')}
                </Text>
                <Chip tone="info" label={t('mom.detail.task')} />
              </View>
            </View>
          ))}
        </Section>
      ) : null}
      <Bullets title={t('mom.detail.risks')} lines={summary.risiko} />
      <Bullets title={t('mom.detail.unclear')} lines={summary.blockers} />
      <Bullets title={t('mom.detail.followUps')} lines={summary.follow_ups} />
    </>
  );
}

function Items({ items: all, team, onPlay }: { items: Item[]; team: boolean; onPlay?: (seconds: number) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [type, setType] = useState('');
  if (!all.length) return <Text tone="inkSoft">{t('mom.detail.noItems')}</Text>;
  const items = filterItems(all, filter, type);
  const hearable = !!onPlay && items.some((item) => secondsOf(item.at ?? '') !== null);
  return (
    <>
      <Banner text={hearable ? `${t('mom.detail.unverified')} ${t('mom.detail.tapToHear')}` : t('mom.detail.unverified')} />
      <ItemFilters items={all} filter={filter} type={type} onFilter={setFilter} onType={setType} />
      {items.length ? null : <Text tone="inkSoft">{t('mom.itemFilters.none')}</Text>}
      {items.map((item) => {
        const seconds = secondsOf(item.at ?? '');
        const playable = onPlay && seconds !== null;
        return (
          <Pressable
            key={item.id}
            accessibilityRole={playable ? 'button' : undefined}
            accessibilityHint={playable ? t('mom.detail.playFrom', { time: item.at }) : undefined}
            disabled={!playable}
            onPress={() => playable && onPlay(seconds)}
            testID={`item-${item.id}`}
            style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
            <View style={styles.rowWrap}>
              <Chip tone="select" label={item.typeLabel || item.type} />
              {item.statusLabel ? <Chip label={item.statusLabel} /> : null}
            </View>
            <Text variant="callout" style={styles.strong}>
              {item.title}
            </Text>
            {item.description ? <Text variant="callout">{item.description}</Text> : null}
            <Text variant="footnote" tone="inkSoft">
              {[item.speaker, item.at].filter(Boolean).join(' · ')}
            </Text>
            <ItemExtra item={item} team={team} />
          </Pressable>
        );
      })}
    </>
  );
}

function Transcript({ recording, onPlay, header }: { recording: number; onPlay: (seconds: number) => void; header?: ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useResource(`mom.transcript.${recording}`, (account) => transcript(account, recording), 300_000);
  if (!segments.data) {
    return (
      <View style={styles.fill}>
        {header}
        <StateView loading={segments.loading || !segments.error} error={segments.error} onRetry={() => void segments.refresh()} testID="transcript" />
      </View>
    );
  }
  return (
    <FlatList
      data={segments.data}
      keyExtractor={(segment) => String(segment.id)}
      contentContainerStyle={styles.content}
      initialNumToRender={20}
      windowSize={7}
      ListHeaderComponent={
        <>
          {header}
          <SmallButton
            label={t('mom.recordingMenu.editor')}
            onPress={() => router.push({ pathname: '/mom/transcript/[recording]', params: { recording: String(recording) } })}
            testID="transcript-edit"
          />
        </>
      }
      ListEmptyComponent={<Text tone="inkSoft">{t('mom.detail.noTranscript')}</Text>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('mom.detail.playFrom', { time: item.clock })}
          onPress={() => onPlay(item.start)}
          style={({ pressed }) => [styles.segment, pressed && { backgroundColor: colors.surface2 }]}>
          <Text variant="footnote" tone="inkSoft" style={styles.mono}>
            {item.clock}
          </Text>
          <View style={styles.entryText}>
            <Text variant="label" tone="selectInk">
              {item.speaker}
            </Text>
            <Text selectable>{item.text}</Text>
          </View>
        </Pressable>
      )}
      testID="transcript-list"
    />
  );
}

export function MeetingView({ meeting, back }: { meeting: number; back: boolean }) {
  const { t } = useTranslation();
  const format = useMomFormat();
  const { height } = useWindowClass();
  const short = height < shortWindow;
  const recordingNow = useRecording();
  const detail = useResource(`mom.detail.${meeting}`, (account) => minutesDetail(account, meeting));
  const [tab, setTab] = useState<Tab>('notes');
  const [which, setWhich] = useState(0);
  const data = detail.data;
  const recordings = data?.recordings ?? [];
  const recording = recordings[Math.min(which, recordings.length - 1)]?.id ?? null;
  const playback = usePlayback(recording);
  const canPlay = !!recording && !recordingNow;
  const play = canPlay ? (seconds: number) => void playback.play(seconds) : undefined;

  if (!data || data.closed) {
    return (
      <View style={styles.fill} testID="mom-meeting">
        <Header title={data?.meeting ?? ''} back={back} />
        {data?.closed ? (
          <StateView empty={{ title: t('mom.detail.closedTitle'), body: t('mom.detail.closedBody') }} />
        ) : (
          <StateView loading={detail.loading || !detail.error} error={detail.error} onRetry={() => void detail.refresh()} testID="meeting" />
        )}
      </View>
    );
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'notes', label: t('mom.detail.tabs.notes') },
    { value: 'items', label: t('mom.detail.tabs.items', { count: data.items.length }) },
    { value: 'transcript', label: t('mom.detail.tabs.transcript') },
    { value: 'final', label: t('mom.detail.tabs.final') },
  ];
  const top = (
    <>
      <Header
        title={data.meeting}
        subtitle={t('mom.meetingLine', { day: format.day(data.day), programme: data.programme })}
        back={back}
        actions={<MeetingMenu meeting={meeting} />}
      />
      <View style={styles.tabs}>
        <Segmented options={tabs} value={tab} onChange={setTab} testID="meeting-tab" />
        {recordings.length > 1 && (tab === 'transcript' || tab === 'notes') ? (
          <Segmented
            options={recordings.map((one, index) => ({ value: String(index), label: one.title }))}
            value={String(which)}
            onChange={(next) => setWhich(Number(next))}
            testID="meeting-recording"
          />
        ) : null}
      </View>
    </>
  );
  const inner = short ? top : undefined;
  const scrolled = (body: ReactNode) => (
    <ScrollView
      contentContainerStyle={short ? styles.shortContent : styles.content}
      refreshControl={<Refresh onRefresh={detail.refresh} />}>
      {inner}
      {short ? <View style={styles.content}>{body}</View> : body}
    </ScrollView>
  );
  const notReady = (
    <Card>
      <MeetingChip row={data} />
      <Text variant="headline">{t('mom.detail.notYet')}</Text>
    </Card>
  );

  return (
    <View style={styles.fill} testID="mom-meeting">
      {short ? null : top}
      <View style={styles.fill}>
        {tab === 'notes'
          ? scrolled(
              <>
                <MinutesBar detail={data} />
                {data.generated ? <Notes detail={data} /> : notReady}
                <MinutesLinks detail={data} />
              </>,
            )
          : null}
        {tab === 'items' ? scrolled(<Items items={data.items} team={!data.isClient} onPlay={recordings.length === 1 ? play : undefined} />) : null}
        {tab === 'transcript' ? (
          recording ? (
            <Transcript key={recording} recording={recording} onPlay={(seconds) => play?.(seconds)} header={inner} />
          ) : (
            scrolled(<Text tone="inkSoft">{t('mom.detail.noTranscript')}</Text>)
          )
        ) : null}
        {tab === 'final' ? <FinalPanel programme={data.programmeId} meeting={data.meeting_id} header={inner} /> : null}
      </View>
      {canPlay && (tab === 'items' || tab === 'transcript' || playback.status.playing) ? <PlayerBar playback={playback} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  strong: { fontWeight: '600' },
  mono: { fontVariant: ['tabular-nums'] },
  shortContent: { paddingBottom: space.xxl },
  tabs: { paddingHorizontal: space.lg, gap: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: readableWidth, alignSelf: 'center', paddingBottom: space.xxl },
  banner: { padding: space.md, borderRadius: radius.md },
  block: { gap: space.sm },
  bullet: { paddingHorizontal: space.lg, paddingVertical: space.md },
  entry: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: 'flex-start' },
  entryText: { flex: 1, gap: space.xs },
  badge: { minWidth: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  item: { borderRadius: radius.card, borderWidth: stroke.thin, padding: space.lg, gap: space.xs },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  segment: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderRadius: radius.md },
});
