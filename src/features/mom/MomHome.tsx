import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../ui/IconButton';
import { seesClientOrg, useMomAccess } from './access';
import { MoreSheet } from './MoreSheet';
import { StatusRow } from './StatusRow';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnection } from '../../api/network';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { Panes } from '../../layout/Panes';
import { useTabBarSpace } from '../../layout/tabBar';
import { readableWidth, useWindowClass } from '../../layout/windowClass';
import { HeaderActions } from '../../screens/HeaderActions';
import { TopAppBar, useScrolledUnder } from '../../ui/AppBar';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { ConnectionBanner } from '../../ui/Banner';
import { StateView } from '../discovery/ui';
import { board } from './api';
import { MeetingView } from './MeetingView';
import { useCurrentProgramme } from '../discovery/Home';
import { Line, MeetingChip, MeetingStatusIcon, needsAction, RecordingCard, SmallButton, UploadCard, useMomFormat, useStatusLabel } from './parts';
import { RecorderBar } from './RecorderScreen';
import { RemoveRecording } from './RemoveRecording';
import { RowActions } from '../../ui/RowActions';
import { textActions } from '../../ui/textActions';
import { useRecording } from './recorder';
import { useUploads } from './uploads';
import { Refresh } from '../../ui/Refresh';

const pageSize = 40;

export function MomHome() {
  const { t } = useTranslation();
  const { t: tChat } = useTranslation('chat');
  const { colors } = useTheme();
  const tabSpace = useTabBarSpace();
  const router = useRouter();
  const format = useMomFormat();
  const statusLabel = useStatusLabel();
  const { current } = useCurrentProgramme();
  const { active } = useSession();
  const { windowClass } = useWindowClass();
  const expanded = windowClass === 'expanded';
  const [limit, setLimit] = useState(pageSize);
  const [selection, setSelection] = useState<{ account: string; meeting: number } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const bar = useScrolledUnder();
  const access = useMomAccess();
  const [removing, setRemoving] = useState<{ meeting: number; title: string } | null>(null);
  const selected = selection && selection.account === active?.id ? selection.meeting : null;
  const meetings = useResource(`mom.board.${limit}`, (account) => board(account, limit));
  const uploads = useUploads(active?.id ?? null);
  const recording = useRecording();
  const ownRecording = recording && recording.account === active?.id ? recording : null;
  const shownClass = useRef(windowClass);

  useEffect(() => {
    const before = shownClass.current;
    shownClass.current = windowClass;
    if (before === 'expanded' && windowClass !== 'expanded' && selected) {
      setSelection(null);
      router.push({ pathname: '/mom/[meeting]', params: { meeting: String(selected) } });
    }
  }, [windowClass, selected, router]);

  const open = (meeting: number) => {
    if (expanded && active) setSelection({ account: active.id, meeting });
    else router.push({ pathname: '/mom/[meeting]', params: { meeting: String(meeting) } });
  };

  const rows = meetings.data?.meetings ?? [];
  const days = groupByDay(rows);
  const refreshMeetings = () => void meetings.refresh();
  const connection = useConnection({ shown: rows.length > 0, failed: meetings.error !== undefined, refresh: refreshMeetings });
  const dayTitle = (day: string) => {
    if (day === localDay(0)) return tChat('time.today');
    if (day === localDay(-1)) return tChat('time.yesterday');
    return format.day(day);
  };
  const menu = <IconButton icon="more" label={t('mom.menu.title')} onPress={() => setMoreOpen(true)} testID="mom-menu" />;
  const list = (
    <View style={styles.fill}>
      <TopAppBar
        title={t('tabs.mom')}
        scrolled={bar.scrolled}
        actions={
          <>
            {menu}
            <HeaderActions />
          </>
        }
      />
      <ScrollView
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: space.xxl + tabSpace }]}
        refreshControl={<Refresh onRefresh={meetings.refresh} testID="mom-refresh" />}
        testID="mom-home">
        <ConnectionBanner notice={connection.notice} onRetry={refreshMeetings} testID="mom-connection" />
        <StatusRow onOpenMeeting={open} />
        {ownRecording ? (
          <RecordingCard recording={ownRecording} onOpen={() => router.push('/mom/record')} />
        ) : (
          <Button label={t('mom.record')} onPress={() => router.push('/mom/new')} testID="mom-record" />
        )}
        {uploads.map((upload) => (
          <UploadCard key={upload.key} upload={upload} />
        ))}
        {rows.length ? (
          days.map(([day, group]) => (
            <Section key={day} title={dayTitle(day)}>
              {group.map((row) => {
                const programme = row.programme.id === current?.id ? undefined : row.programme.name;
                const status = statusLabel(row);
                const summary = [row.name, `${format.day(row.day)} · ${row.programme.name}`, status].filter(Boolean).join('\n');
                return (
                  <RowActions
                    key={row.id}
                    title={row.name}
                    subtitle={row.programme.name}
                    actions={[
                      { key: 'open', icon: 'forward', label: t('row.open'), onPress: () => open(row.id) },
                      ...textActions(t, summary),
                      ...(row.recordings
                        ? [{ key: 'remove', icon: 'trash' as const, label: t('mom.remove.action'), tone: 'danger' as const, onPress: () => setRemoving({ meeting: row.id, title: row.name }) }]
                        : []),
                    ]}
                    start={['share']}
                    end={row.recordings ? ['remove', 'more'] : ['more']}
                    testID={`meeting-${row.id}`}>
                    {(bind) => (
                  <Line
                    bind={bind}
                    icon={row.generatedAt ? 'minutes' : 'wave'}
                    title={row.name}
                    detail={programme}
                    trailing={needsAction(row) ? <MeetingChip row={row} /> : undefined}
                    end={needsAction(row) ? undefined : <MeetingStatusIcon row={row} />}
                    label={[row.name, programme, status].filter(Boolean).join(', ')}
                    selected={expanded ? selected === row.id : undefined}
                    onPress={() => open(row.id)}
                    testID={`meeting-${row.id}`}
                  />
                    )}
                  </RowActions>
                );
              })}
            </Section>
          ))
        ) : (
          <StateView
            offline={!connection.online}
            loading={meetings.loading && !meetings.data}
            error={meetings.error}
            empty={{ title: t('mom.noneTitle'), icon: 'minutes' }}
            onRetry={refreshMeetings}
            testID="mom-meetings"
          />
        )}
        {meetings.data && meetings.data.total > rows.length ? (
          <SmallButton label={t('mom.more')} onPress={() => setLimit((count) => count + pageSize)} testID="mom-more" />
        ) : null}
      </ScrollView>
    </View>
  );

  const detail = (
    <View style={styles.fill}>
      {ownRecording ? <RecorderBar recording={ownRecording} /> : null}
      {selected ? (
        <MeetingView key={selected} meeting={selected} back={false} />
      ) : (
        <View style={[styles.fill, styles.center, { backgroundColor: colors.surface2 }]}>
          <Text tone="inkSoft" style={styles.centerText}>
            {t('mom.detail.pick')}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={expanded ? ['top', 'right', 'bottom'] : ['top', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="tab-mom">
      <Panes list={list} detail={detail} />
      {moreOpen ? (
        <MoreSheet
          title={t('mom.menu.title')}
          groups={[
            {
              key: 'work',
              actions: [
                { key: 'followups', icon: 'steps', label: t('mom.followups.title'), detail: t('mom.followups.menuDetail'), onPress: () => router.push('/mom/followups') },
                ...(seesClientOrg(access)
                  ? [{ key: 'clientOrg', icon: 'people' as const, label: t('mom.clientOrg.title'), detail: t('mom.clientOrg.menuDetail'), onPress: () => router.push('/mom/client-org') }]
                  : []),
              ],
            },
            {
              key: 'lists',
              title: t('mom.menu.lists'),
              actions: [
                { key: 'recordings', icon: 'wave', label: t('mom.records.recordings'), onPress: () => router.push({ pathname: '/mom/list/[kind]', params: { kind: 'recordings' } }) },
                { key: 'minutes', icon: 'minutes', label: t('mom.records.minutes'), onPress: () => router.push({ pathname: '/mom/list/[kind]', params: { kind: 'minutes' } }) },
                { key: 'removals', icon: 'trash', label: t('mom.records.removals'), onPress: () => router.push({ pathname: '/mom/list/[kind]', params: { kind: 'removals' } }) },
              ],
            },
            {
              key: 'admin',
              title: t('mom.admin.group'),
              actions: [
                ...(access?.manager || access?.system
                  ? [{ key: 'keys', icon: 'lock' as const, label: t('mom.admin.keys.title'), onPress: () => router.push({ pathname: '/mom/admin/[part]', params: { part: 'keys' } }) }]
                  : []),
                ...(access?.system
                  ? [
                      { key: 'import', icon: 'cloudUpload' as const, label: t('mom.admin.import.title'), onPress: () => router.push({ pathname: '/mom/admin/[part]', params: { part: 'import' } }) },
                      { key: 'settings', icon: 'steps' as const, label: t('mom.admin.settings.title'), onPress: () => router.push({ pathname: '/mom/admin/[part]', params: { part: 'settings' } }) },
                    ]
                  : []),
              ],
            },
          ]}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
      {removing && active ? (
        <RemoveRecording
          account={active}
          meeting={removing.meeting}
          title={removing.title}
          onRemoved={() => void meetings.refresh()}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function localDay(offset: number): string {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

function groupByDay<T extends { day: string }>(rows: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.day);
    if (group) group.push(row);
    else groups.set(row.day, [row]);
  }
  return [...groups];
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  centerText: { textAlign: 'center', maxWidth: readableWidth },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.lg, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
