import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { Panes } from '../../layout/Panes';
import { readableWidth, useWindowClass } from '../../layout/windowClass';
import { HeaderActions } from '../../screens/HeaderActions';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { StateView } from '../discovery/ui';
import { board } from './api';
import { MeetingView } from './MeetingView';
import { Line, MeetingChip, RecordingCard, SmallButton, UploadCard, useMomFormat } from './parts';
import { RecorderBar } from './RecorderScreen';
import { useRecording } from './recorder';
import { useUploads } from './uploads';

const pageSize = 40;

export function MomHome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const format = useMomFormat();
  const { active } = useSession();
  const { windowClass } = useWindowClass();
  const expanded = windowClass === 'expanded';
  const [limit, setLimit] = useState(pageSize);
  const [selection, setSelection] = useState<{ account: string; meeting: number } | null>(null);
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
  const list = (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={meetings.loading && !!meetings.data} onRefresh={() => void meetings.refresh()} />}
      testID="mom-home">
      <View style={styles.top}>
        <Text variant="display" accessibilityRole="header" style={styles.fill}>
          {t('tabs.mom')}
        </Text>
        <HeaderActions />
      </View>
      {ownRecording ? (
        <RecordingCard recording={ownRecording} onOpen={() => router.push('/mom/record')} />
      ) : (
        <Button label={t('mom.record')} onPress={() => router.push('/mom/new')} testID="mom-record" />
      )}
      {uploads.map((upload) => (
        <UploadCard key={upload.key} upload={upload} />
      ))}
      {rows.length ? (
        <Section title={t('mom.meetings')}>
          {rows.map((row) => (
            <Line
              key={row.id}
              icon={row.generatedAt ? 'minutes' : 'wave'}
              title={row.name}
              detail={t('mom.meetingLine', { day: format.day(row.day), programme: row.programme.name })}
              trailing={<MeetingChip row={row} />}
              selected={expanded ? selected === row.id : undefined}
              onPress={() => open(row.id)}
              testID={`meeting-${row.id}`}
            />
          ))}
        </Section>
      ) : (
        <StateView
          loading={meetings.loading && !meetings.data}
          error={meetings.data ? undefined : meetings.error}
          empty={{ title: t('mom.noneTitle'), body: t('mom.noneBody') }}
          onRetry={() => void meetings.refresh()}
          testID="mom-meetings"
        />
      )}
      {meetings.data && meetings.data.total > rows.length ? (
        <SmallButton label={t('mom.more')} onPress={() => setLimit((count) => count + pageSize)} testID="mom-more" />
      ) : null}
    </ScrollView>
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
    <SafeAreaView edges={['top', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="tab-mom">
      <Panes list={list} detail={detail} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  centerText: { textAlign: 'center', maxWidth: readableWidth },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl, gap: space.lg, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm },
});
