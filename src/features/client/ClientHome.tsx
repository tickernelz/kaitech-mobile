import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bearerHeaders } from '../../api/odoo';
import { useConnection } from '../../api/network';
import { useResource } from '../../api/resource';
import type { Account } from '../../auth/oauth';
import { useSession } from '../../auth/session';
import { useLanguage } from '../../i18n';
import { intlLocale } from '../../i18n/language';
import { useTabBarSpace } from '../../layout/tabBar';
import { HeaderActions } from '../../screens/HeaderActions';
import { radius, space, stroke, useTheme } from '../../theme';
import { TopAppBar, useScrolledUnder } from '../../ui/AppBar';
import { ConnectionBanner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { notify, prompt } from '../../ui/dialog';
import { Icon } from '../../ui/icons';
import { Pressable } from '../../ui/Pressable';
import { Refresh } from '../../ui/Refresh';
import { Text } from '../../ui/Text';
import { openPdf } from '../chat/media/viewer';
import { StateView, useErrorText } from '../discovery/ui';
import { askCorrection, clientHome, handOver, interviewUrl, minutesFilePath, reportDone } from './api';
import { dayLabel, documentWaits, isQuiet, todoWaits, type Minutes, type ProgrammeBlock } from './home';

type Act = (key: string, work: () => Promise<boolean | void>, done?: string) => Promise<void>;

function openMinutes(account: Account, item: Minutes) {
  openPdf({
    accountId: account.id,
    origin: account.origin,
    attachment: {
      id: -item.meetingId,
      name: `${item.number || item.subject || item.meetingId}.pdf`,
      mimetype: 'application/pdf',
      size: 0,
      voice: false,
      accessToken: null,
      checksum: `minutes-${item.meetingId}-${item.state}-${item.correctionsUntil}`,
      url: null,
    },
    source: { url: `${account.origin}${minutesFilePath(item.meetingId)}`, headers: () => bearerHeaders(account) },
  });
}

function Line({ title, detail, tone, onPress, action, testID }: { title: string; detail?: string; tone?: 'inkSoft' | 'dangerInk'; onPress?: () => void; action?: ReactNode; testID: string }) {
  const { colors } = useTheme();
  const body = (
    <>
      <View style={styles.lineText}>
        <Text variant="body" numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text variant="callout" tone={tone ?? 'inkSoft'}>
            {detail}
          </Text>
        ) : null}
      </View>
      {action}
      {onPress && !action ? <Icon name="forward" size={20} color={colors.inkFaint} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.line} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} android_ripple={{ color: `${colors.ink}1A`, foreground: true }} style={styles.line} testID={testID}>
      {body}
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="callout" tone="inkSoft" accessibilityRole="header" style={styles.groupTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function SmallAction({ label, busy, onPress, testID }: { label: string; busy: boolean; onPress: () => void; testID: string }) {
  return <Button kind="secondary" label={label} busy={busy} onPress={onPress} style={styles.smallAction} testID={testID} />;
}

function Programme({ block, account, busy, act }: { block: ProgrammeBlock; account: Account; busy: string | null; act: Act }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const locale = intlLocale(language);
  const day = (iso: string) => dayLabel(iso, locale);
  const firstInterview = block.interviews[0];
  const openInterview = (inviteId: number) => act(`interview-${inviteId}`, async () => {
    await WebBrowser.openBrowserAsync(await interviewUrl(account, inviteId));
    return false;
  });
  const sendFile = (requestId: number) =>
    act(`document-${requestId}`, async () => {
      const picked = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset) return false;
      await handOver(account, requestId, asset.uri, asset.mimeType ?? 'application/octet-stream');
    }, t('home.documents.sent'));
  const correct = (meetingId: number) =>
    act(`minutes-${meetingId}`, async () => {
      const words = await prompt({
        title: t('home.minutes.correctTitle'),
        body: t('home.minutes.correctBody'),
        input: { label: t('home.minutes.correctLabel'), multiline: true, required: true },
        confirm: t('home.minutes.correctSend'),
        cancel: t('home.cancel'),
        testID: 'home-correct-dialog',
      });
      if (!words?.trim()) return false;
      await askCorrection(account, meetingId, words.trim());
    }, t('home.minutes.correctSent'));
  const report = (actionId: number) =>
    act(`todo-${actionId}`, async () => {
      const note = await prompt({
        title: t('home.todos.reportTitle'),
        body: t('home.todos.reportBody'),
        input: { label: t('home.todos.noteLabel'), multiline: true },
        confirm: t('home.todos.reportSend'),
        cancel: t('home.cancel'),
        testID: 'home-report-dialog',
      });
      if (note === null) return false;
      await reportDone(account, actionId, note.trim());
    }, t('home.todos.reported'));
  const waitingOthers = block.team.map((member) => t('home.teamMember', { person: member.person, count: member.total })).join(', ');
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]} testID={`home-programme-${block.engagementId}`}>
      <View style={styles.cardHead}>
        <Text variant="headline" accessibilityRole="header" style={styles.flex}>
          {block.programme}
        </Text>
        {block.stage ? (
          <Text variant="callout" tone="inkSoft">
            {t('home.stage', { stage: block.stage })}
          </Text>
        ) : null}
      </View>
      {isQuiet(block) ? (
        <Text variant="callout" tone="inkSoft" style={styles.quiet} testID={`home-quiet-${block.engagementId}`}>
          {t('home.quiet')}
        </Text>
      ) : null}
      {block.interviews.length ? (
        <Group title={t('home.interviews.title')}>
          {block.interviews.map((item) => (
            <Line
              key={item.inviteId}
              title={item.topic || t('home.interviews.untitled')}
              detail={[item.stage ? t(`home.interviews.stage.${item.stage}`) : '', item.expiresOn ? t('home.interviews.until', { day: day(item.expiresOn) }) : ''].filter(Boolean).join(' · ') || undefined}
              onPress={() => void openInterview(item.inviteId)}
              testID={`home-interview-${item.inviteId}`}
            />
          ))}
        </Group>
      ) : null}
      {block.documents.length ? (
        <Group title={t('home.documents.title')}>
          {block.documents.map((item) => (
            <Line
              key={item.requestId}
              title={item.document}
              detail={
                item.unreadable
                  ? t('home.documents.broken')
                  : item.handedOverOn
                    ? t('home.documents.handed', { day: day(item.handedOverOn) })
                    : item.why || undefined
              }
              tone={item.unreadable ? 'dangerInk' : undefined}
              action={documentWaits(item) ? <SmallAction label={t('home.documents.send')} busy={busy === `document-${item.requestId}`} onPress={() => void sendFile(item.requestId)} testID={`home-send-${item.requestId}`} /> : undefined}
              testID={`home-document-${item.requestId}`}
            />
          ))}
        </Group>
      ) : null}
      {block.data.length ? (
        <Group title={t('home.data.title')}>
          {block.data.map((item) => (
            <Line
              key={item.grantId}
              title={item.name}
              detail={[item.purpose, t('home.data.through')].filter(Boolean).join('\n')}
              onPress={firstInterview ? () => void openInterview(firstInterview.inviteId) : undefined}
              testID={`home-data-${item.grantId}`}
            />
          ))}
        </Group>
      ) : null}
      {block.minutes.length ? (
        <Group title={t('home.minutes.title')}>
          {block.minutes.map((item) => (
            <Line
              key={item.meetingId}
              title={item.heldOn ? t('home.minutes.row', { subject: item.subject, day: day(item.heldOn) }) : item.subject}
              detail={item.state === 'open' && item.correctionsUntil ? t('home.minutes.until', { day: day(item.correctionsUntil) }) : t(`home.minutes.state.${item.state}`)}
              onPress={item.hasFile ? () => openMinutes(account, item) : undefined}
              action={item.state === 'open' ? <SmallAction label={t('home.minutes.correct')} busy={busy === `minutes-${item.meetingId}`} onPress={() => void correct(item.meetingId)} testID={`home-correct-${item.meetingId}`} /> : undefined}
              testID={`home-minutes-${item.meetingId}`}
            />
          ))}
        </Group>
      ) : null}
      {block.todos.length ? (
        <Group title={t('home.todos.title')}>
          {block.todos.map((item) => (
            <Line
              key={item.actionId}
              title={item.name}
              detail={
                item.reportedOn
                  ? t('home.todos.reportedOn', { day: day(item.reportedOn) })
                  : item.sentBack
                    ? t('home.todos.sentBack')
                    : item.due
                      ? t(item.late ? 'home.todos.late' : 'home.todos.due', { day: day(item.due) })
                      : undefined
              }
              tone={!item.reportedOn && (item.late || item.sentBack) ? 'dangerInk' : undefined}
              action={todoWaits(item) ? <SmallAction label={t('home.todos.report')} busy={busy === `todo-${item.actionId}`} onPress={() => void report(item.actionId)} testID={`home-report-${item.actionId}`} /> : undefined}
              testID={`home-todo-${item.actionId}`}
            />
          ))}
        </Group>
      ) : null}
      {block.published || waitingOthers ? (
        <View style={[styles.foot, { borderTopColor: colors.line }]}>
          {block.published ? (
            <Text variant="callout" tone="inkSoft" testID={`home-published-${block.engagementId}`}>
              {t('home.published', { count: block.published })}
            </Text>
          ) : null}
          {waitingOthers ? (
            <Text variant="callout" tone="inkSoft" testID={`home-team-${block.engagementId}`}>
              {t('home.team', { people: waitingOthers })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Skeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="home-skeleton">
      {[0.6, 0.8, 0.7].map((width, index) => (
        <View key={index} style={styles.line}>
          <View style={styles.lineText}>
            <View style={[styles.bone, { width: `${width * 100}%`, backgroundColor: colors.surface2 }]} />
            <View style={[styles.bone, styles.boneSmall, { backgroundColor: colors.surface2 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ClientHome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const tabSpace = useTabBarSpace();
  const bar = useScrolledUnder();
  const errorText = useErrorText();
  const home = useResource('client.home', clientHome, 30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const blocks = home.data ?? [];
  const connection = useConnection({ shown: blocks.length > 0, failed: home.error !== undefined, refresh: () => void home.refresh() });
  const act: Act = async (key, work, done) => {
    if (busy) return;
    setBusy(key);
    try {
      const changed = await work();
      if (changed === false) return;
      await home.refresh();
      if (done) notify(done);
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(null);
    }
  };
  return (
    <SafeAreaView edges={['top', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="tab-home">
      <TopAppBar title={t('tabs.home')} scrolled={bar.scrolled} actions={<HeaderActions />} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: space.lg + tabSpace }]}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
        refreshControl={<Refresh onRefresh={home.refresh} />}>
        <ConnectionBanner notice={connection.notice} onRetry={() => void home.refresh()} testID="home-connection" />
        {active && blocks.length ? (
          blocks.map((block) => <Programme key={block.engagementId} block={block} account={active} busy={busy} act={act} />)
        ) : home.loading && !home.data && connection.online ? (
          <Skeleton />
        ) : (
          <StateView
            offline={!connection.online}
            error={home.error}
            empty={{ title: t('home.emptyTitle'), body: t('home.emptyBody'), icon: 'compass' }}
            onRetry={() => void home.refresh()}
            testID="home"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.lg },
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', paddingVertical: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  quiet: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  group: { paddingTop: space.sm },
  groupTitle: { paddingHorizontal: space.lg, paddingBottom: space.xs, fontWeight: '600' },
  line: { minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md },
  lineText: { flex: 1, gap: 2 },
  smallAction: { flexShrink: 0 },
  foot: { borderTopWidth: stroke.hairline, marginTop: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs, gap: space.xs },
  bone: { height: 14, borderRadius: radius.sm },
  boneSmall: { width: '40%', height: 12 },
});
