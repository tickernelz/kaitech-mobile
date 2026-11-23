import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { space, useTheme } from '../../theme';
import { IconButton } from '../../ui/IconButton';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { useCurrentProgramme } from '../discovery/Home';
import { Header } from '../discovery/Header';
import { Card, Segmented, StateView, useErrorText } from '../discovery/ui';
import { ChoiceRow, FollowupLine } from './followupParts';
import { followupBoard, followupStatuses, rescan, type FeedEntry, type FollowupBoard, type FollowupMeeting, type FollowupStatus } from './followups';
import { MoreSheet } from './MoreSheet';
import { Line, SmallButton, useMomFormat } from './parts';

type Pane = 'list' | 'team' | 'meetings' | 'updates';

const pageSize = 40;
const settleMs = 300;
const scanningEveryMs = 15_000;

export function FollowupsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const { active } = useSession();
  const { current } = useCurrentProgramme();
  const programme = current?.id ?? 0;
  const [view, setView] = useState<Pane>('list');
  const [status, setStatus] = useState<FollowupStatus>('all');
  const [owner, setOwner] = useState(0);
  const [meeting, setMeeting] = useState(0);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), settleMs);
    return () => clearTimeout(timer);
  }, [typed]);
  const query = { programme, status, owner, meeting, search, limit };
  const board = useResource(programme ? `mom.followups.${JSON.stringify(query)}` : null, (account) => followupBoard(account, query));
  const data = board.data;
  const scanning = data?.scanning ?? 0;
  const refresh = board.refresh;
  useEffect(() => {
    if (!scanning) return undefined;
    const timer = setInterval(() => void refresh(), scanningEveryMs);
    return () => clearInterval(timer);
  }, [scanning, refresh]);

  const filter = (next: { owner?: number; meeting?: number }) => {
    if (next.owner !== undefined) setOwner(next.owner);
    if (next.meeting !== undefined) setMeeting(next.meeting);
    setLimit(pageSize);
    setView('list');
  };
  const open = (id: number) => router.push({ pathname: '/mom/followup/[id]', params: { id: String(id) } });
  const startRescan = async () => {
    if (!active || !programme) return;
    try {
      const answer = await rescan(active, programme);
      invalidate(`${active.id}:mom.followups.`);
      Alert.alert('', t('mom.followups.rescanStarted', { count: answer.meetings }));
    } catch (error) {
      Alert.alert('', errorText(error));
    }
  };

  const ownerName = data?.owners.find((one) => one.id === owner)?.name ?? (owner === -1 ? t('mom.followups.nobody') : '');
  const meetingName = data?.meetingChoices.find((one) => one.id === meeting)?.name ?? data?.meetings.find((one) => one.id === meeting)?.name ?? '';
  const filtered = status === 'all' && !owner && !meeting && !search;
  const views: { value: Pane; label: string }[] = [
    { value: 'list', label: t('mom.followups.views.list') },
    { value: 'team', label: t('mom.followups.views.team') },
    { value: 'meetings', label: t('mom.followups.views.meetings') },
    { value: 'updates', label: t('mom.followups.views.updates') },
  ];

  const top = (
    <View style={styles.top}>
      {data ? (
        <Text tone="inkSoft" testID="followups-summary">
          {t('mom.followups.summary', { done: data.kpi.done, total: data.kpi.total, late: data.kpi.late, completion: data.kpi.completion })}
        </Text>
      ) : null}
      {scanning ? (
        <Text variant="footnote" tone="inkSoft" accessibilityRole="alert">
          {t('mom.followups.scanning', { count: scanning })}
        </Text>
      ) : null}
      <Segmented options={views} value={view} onChange={setView} testID="followups-view" />
      {view === 'list' ? (
        <>
          <ChoiceRow
            options={followupStatuses.map((one) => ({ value: one, label: `${t(`mom.followups.status.${one}`)} ${data?.chips[one] ?? ''}`.trim() }))}
            value={status}
            onChange={(next) => {
              setStatus(next);
              setLimit(pageSize);
            }}
            testID="followups-status"
          />
          <TextField label={t('mom.records.search')} value={typed} onChangeText={setTyped} returnKeyType="search" autoCorrect={false} testID="followups-search" />
          {owner || meeting ? (
            <View style={styles.filters}>
              {owner ? <SmallButton label={t('mom.followups.clearOwner', { name: ownerName })} onPress={() => filter({ owner: 0 })} testID="followups-clear-owner" /> : null}
              {meeting ? <SmallButton label={t('mom.followups.clearMeeting', { name: meetingName })} onPress={() => filter({ meeting: 0 })} testID="followups-clear-meeting" /> : null}
            </View>
          ) : null}
          {filtered && data?.attention.length ? (
            <Section title={t('mom.followups.attention')}>
              {data.attention.map((row) => (
                <FollowupLine key={row.id} row={row} onPress={() => open(row.id)} />
              ))}
            </Section>
          ) : null}
          {data?.items.length ? (
            <Text variant="footnote" tone="inkSoft" accessibilityRole="header">
              {t('mom.followups.shown', { shown: data.items.length, total: data.page.total })}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const state = (
    <StateView
      loading={(board.loading && !data) || (!programme && !current)}
      error={data ? undefined : board.error}
      empty={programme ? { title: t('mom.followups.none'), icon: 'steps' } : { title: t('mom.setup.noProgramme'), icon: 'steps' }}
      onRetry={() => void board.refresh()}
      testID="followups"
    />
  );

  const body: Record<Pane, ReactNode> = {
    list: null,
    team: data ? <Team board={data} onPick={(id) => filter({ owner: id })} /> : state,
    meetings: data ? <Meetings board={data} onPick={(id) => filter({ meeting: id })} /> : state,
    updates: data ? <Updates feed={data.feed} onOpen={open} /> : state,
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="mom-followups">
      <Header
        title={t('mom.followups.title')}
        subtitle={current?.name}
        actions={programme ? <IconButton icon="more" label={t('mom.menu.title')} onPress={() => setMoreOpen(true)} testID="followups-more" /> : undefined}
      />
      <FlatList
        data={view === 'list' ? (data?.items ?? []) : []}
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={board.loading && !!data} onRefresh={() => void board.refresh()} />}
        ListHeaderComponent={top}
        renderItem={({ item }) => <FollowupLine row={item} onPress={() => open(item.id)} />}
        ListEmptyComponent={view === 'list' ? state : <View style={styles.body}>{body[view]}</View>}
        ListFooterComponent={
          view === 'list' && data && data.page.total > data.items.length ? (
            <SmallButton label={t('mom.more')} onPress={() => setLimit((count) => count + pageSize)} testID="followups-page" />
          ) : undefined
        }
      />
      {moreOpen ? (
        <MoreSheet
          title={t('mom.menu.title')}
          groups={[
            {
              key: 'work',
              actions: [
                { key: 'add', icon: 'steps', label: t('mom.followups.add'), onPress: () => router.push('/mom/followup/new') },
                { key: 'rescan', icon: 'retry', label: t('mom.followups.rescan'), detail: t('mom.followups.rescanDetail'), onPress: () => void startRescan() },
              ],
            },
          ]}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Team({ board, onPick }: { board: FollowupBoard; onPick: (owner: number) => void }) {
  const { t } = useTranslation();
  if (!board.rollup.length) return <StateView empty={{ title: t('mom.followups.noneTeam'), icon: 'people' }} />;
  return (
    <Section>
      {board.rollup.map((one) => (
        <Line
          key={one.id}
          icon="people"
          title={one.name || t('mom.followups.nobody')}
          detail={t('mom.followups.teamLine', { done: one.done, total: one.total, late: one.late, average: one.average })}
          onPress={() => onPick(one.id || -1)}
          testID={`followups-owner-${one.id}`}
        />
      ))}
    </Section>
  );
}

function Bullets({ title, lines }: { title: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <View style={styles.bullets}>
      <Text variant="callout" style={styles.strong}>
        {title}
      </Text>
      {lines.map((line, index) => (
        <Text key={index} variant="callout">{`• ${line}`}</Text>
      ))}
    </View>
  );
}

function Meetings({ board, onPick }: { board: FollowupBoard; onPick: (meeting: number) => void }) {
  const { t } = useTranslation();
  const format = useMomFormat();
  if (!board.meetings.length) return <StateView empty={{ title: t('mom.followups.noneMeetings'), icon: 'meeting' }} />;
  return (
    <View style={styles.body}>
      {board.meetings.map((one: FollowupMeeting) => (
        <Card key={one.id} testID={`followups-meeting-${one.id}`}>
          <Text variant="headline">{one.name}</Text>
          <Text variant="footnote" tone="inkSoft">
            {[one.date ? format.day(one.date) : '', one.status].filter(Boolean).join(' · ')}
          </Text>
          {one.narrative ? <Text variant="callout">{one.narrative}</Text> : null}
          <Bullets title={t('mom.followups.positives')} lines={one.positives} />
          <Bullets title={t('mom.followups.decisions')} lines={one.decisions} />
          <Bullets title={t('mom.followups.help')} lines={one.help} />
          {one.itemIds.length ? <SmallButton label={t('mom.followups.ofMeeting', { count: one.itemIds.length })} onPress={() => onPick(one.id)} /> : null}
        </Card>
      ))}
    </View>
  );
}

function Updates({ feed, onOpen }: { feed: FeedEntry[]; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  if (!feed.length) return <StateView empty={{ title: t('mom.followups.noneUpdates'), icon: 'clock' }} />;
  return (
    <Section>
      {feed.map((entry) => (
        <Line
          key={entry.id}
          icon="clock"
          title={entry.action.code ? `${entry.action.code} · ${entry.action.name}` : entry.action.name}
          detail={[entry.percent !== false ? `${entry.percent}%` : '', entry.note, entry.quote ? `"${entry.quote}"` : '', [entry.by, entry.meeting ? entry.meeting.name : '', entry.saidOn || entry.at].filter(Boolean).join(' · ')]
            .filter(Boolean)
            .join('\n')}
          onPress={() => onOpen(entry.action.id)}
          testID={`followups-update-${entry.id}`}
        />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  strong: { fontWeight: '600' },
  top: { gap: space.md, paddingBottom: space.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  body: { gap: space.md },
  bullets: { gap: space.xs },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xs, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
