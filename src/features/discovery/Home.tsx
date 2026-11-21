import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { Panes } from '../../layout/Panes';
import { useWindowClass } from '../../layout/windowClass';
import { HeaderActions } from '../../screens/HeaderActions';
import { radius, space, useTheme } from '../../theme';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { counts, findings, panel, programmes, type Panel, type Programme } from './api';
import { CoworkerThread } from './CoworkerThread';
import { Header } from './Header';
import { openConversation, rememberProgramme, useLastProgramme, useOpenConversation } from './store';
import { Icon, type IconName } from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { Card, Chip, StateView } from './ui';
import { useLatestConversation } from './useLatestConversation';

export function useCurrentProgramme(): { list: ReturnType<typeof useResource<Programme[]>>; current: Programme | null } {
  const { active } = useSession();
  const list = useResource('discovery.programmes', programmes, 60_000);
  const last = useLastProgramme(active?.id ?? null);
  const rows = list.data ?? [];
  const current = rows.find((row) => row.id === last) ?? rows[0] ?? null;
  return { list, current };
}

function Metric({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={16} color={colors.inkSoft} />
      <Text variant="callout" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.shrink}>
        <Text variant="callout" style={styles.strong}>{value}</Text> {label}
      </Text>
    </View>
  );
}

function Summary({ data, programme }: { data: Panel; programme: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { number } = useFormatters();
  const tally = useResource(`discovery.counts.${programme}`, (account) => counts(account, programme));
  const { question_answered: answered, question_total: total, gates_signed: signed, gates_total: gates } = data.progress;
  const share = total ? Math.min(1, answered / total) : 0;
  return (
    <Card testID="programme-summary">
      <View style={styles.rowWrap}>
        {data.state === 'discovery' ? null : <Chip tone="select" label={data.state_label || data.state} />}
        {gates ? (
          <Text variant="footnote" tone="inkSoft">
            {t('discovery.home.gates', { signed: number(signed), total: number(gates) })}
          </Text>
        ) : null}
      </View>
      <View style={styles.metrics}>
        <Metric icon="thread" value={tally.data ? number(tally.data.evidence) : '–'} label={t('discovery.home.evidence')} />
        <Metric icon="bulb" value={tally.data ? number(tally.data.findings) : '–'} label={t('discovery.home.findings')} />
        <Metric icon="doc" value={number(data.sources)} label={t('discovery.home.sources')} />
      </View>
      <Text variant="footnote" tone="inkSoft">
        {t('discovery.home.questions')} · <Text variant="footnote" style={styles.strong}>{t('discovery.home.answered', { answered: number(answered), total: number(total) })}</Text>
      </Text>
      <View
        style={[styles.track, { backgroundColor: colors.line }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: answered }}>
        <View style={[styles.bar, { backgroundColor: colors.ok, width: `${Math.round(share * 100)}%` }]} />
      </View>
    </Card>
  );
}

function Line({
  icon,
  title,
  detail,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const body = (
    <>
      <View style={[styles.lineIcon, { backgroundColor: colors.surface2 }]}>
        <Icon name={icon} size={20} color={colors.selectInk} />
      </View>
      <View style={styles.lineText}>
        <Text variant="callout" style={styles.strong}>
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" tone="inkSoft">
            {detail}
          </Text>
        ) : null}
      </View>
      {onPress ? <Icon name="forward" size={20} color={colors.inkFaint} /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      android_ripple={{ color: colors.select }}
      style={({ pressed }) => [styles.line, pressed && { backgroundColor: colors.surface2 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.line} testID={testID}>
      {body}
    </View>
  );
}

function AskBar({ name, onPress }: { name: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('discovery.home.ask', { name })}
      onPress={onPress}
      testID="discovery-ask"
      style={({ pressed }) => [styles.ask, { backgroundColor: pressed ? colors.select : colors.surface2, borderColor: colors.line }]}>
      <Icon name="sparkle" color={colors.selectInk} />
      <Text tone="selectInk" style={styles.fill} numberOfLines={1}>
        {t('discovery.home.askShort')}
      </Text>
    </Pressable>
  );
}

export function DiscoveryHome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const { windowClass } = useWindowClass();
  const expanded = windowClass === 'expanded';
  const { list, current } = useCurrentProgramme();
  const programme = current?.id ?? 0;
  const account = active?.id ?? '';
  const programmePanel = useResource(programme ? `discovery.panel.${programme}` : null, (signedIn) => panel(signedIn, programme));
  const latest = useResource(programme ? `discovery.findings.${programme}` : null, (signedIn) => findings(signedIn, programme));
  const conversation = useOpenConversation(account, programme);
  const [focusCard, setFocusCard] = useState<number>();
  const [focusInput, setFocusInput] = useState(0);
  const threadActive = useRef(false);
  const shownClass = useRef(windowClass);

  useEffect(() => {
    const before = shownClass.current;
    shownClass.current = windowClass;
    if (before === 'expanded' && windowClass !== 'expanded' && threadActive.current && programme) {
      threadActive.current = false;
      router.push({ pathname: '/program/[id]/coworker', params: { id: String(programme) } });
    }
  }, [windowClass, programme, router]);
  useLatestConversation(programme);

  useEffect(() => {
    if (current && active) rememberProgramme(active.id, current.id);
  }, [current, active]);

  const openCoworker = (fresh: boolean) => {
    if (fresh) {
      openConversation(account, programme, null);
      setFocusCard(undefined);
    }
    if (expanded) {
      setFocusInput((count) => count + 1);
      threadActive.current = true;
    }
    else router.push({ pathname: '/program/[id]/coworker', params: { id: String(programme), ask: '1' } });
  };

  const openCard = (packet: { id: number; conversation_id: number }) => {
    if (expanded) {
      if (packet.conversation_id) openConversation(account, programme, packet.conversation_id);
      setFocusCard(packet.id);
      threadActive.current = true;
    } else {
      router.push({ pathname: '/program/card/[id]', params: { id: String(packet.id), programme: String(programme), conversation: String(packet.conversation_id) } });
    }
  };

  const refreshing = programmePanel.loading || list.loading;
  const refresh = () => {
    void list.refresh();
    void programmePanel.refresh();
    void latest.refresh();
  };

  const home = (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing && !!programmePanel.data} onRefresh={refresh} />}
      testID="discovery-home">
      <View style={styles.top}>
        <Text variant="display" accessibilityRole="header" style={styles.fill}>
          {t('tabs.discovery')}
        </Text>
        <HeaderActions />
      </View>
      {current ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('discovery.home.switch', { name: current.name })}
          onPress={() => router.push('/program/pick')}
          testID="programme-switch"
          style={({ pressed }) => [styles.switch, { backgroundColor: pressed ? colors.select : colors.surface, borderColor: colors.line }]}>
          <Text variant="callout" tone="selectInk" numberOfLines={1} style={styles.shrink}>
            {current.name}
          </Text>
          <Icon name="chevronDown" size={20} color={colors.selectInk} />
        </Pressable>
      ) : null}
      {!current ? (
        <StateView
          loading={list.loading && !list.data}
          error={list.data ? undefined : list.error}
          empty={{ title: t('discovery.home.noneTitle'), icon: 'compass' }}
          onRetry={() => void list.refresh()}
          testID="discovery-programmes"
        />
      ) : programmePanel.data ? (
        <>
          <Summary data={programmePanel.data} programme={programme} />
          <AskBar name={current.name} onPress={() => openCoworker(true)} />
          {programmePanel.data.packets.length || programmePanel.data.needs_you.length ? (
            <Section title={t('discovery.home.waiting')}>
              {programmePanel.data.packets.map((packet) => (
                <Line
                  key={`packet-${packet.id}`}
                  icon="decision"
                  title={packet.name}
                  onPress={() => openCard(packet)}
                  testID={`waiting-card-${packet.id}`}
                />
              ))}
              {programmePanel.data.needs_you.map((line) => (
                <Line key={`agenda-${line.kind}`} icon="bulb" title={line.headline} />
              ))}
            </Section>
          ) : null}
          <Section>
            <Line
              icon="doc"
              title={t('discovery.home.evidenceAndFindings')}
              onPress={() => router.push(`/program/${programme}/evidence`)}
              testID="open-evidence"
            />
            <Line
              icon="history"
              title={t('discovery.home.conversations')}
              onPress={() => router.push(`/program/${programme}/conversations`)}
              testID="open-conversations"
            />
          </Section>
          {latest.data?.length ? (
            <Section title={t('discovery.home.recent')}>
              {latest.data.slice(0, 3).map((row) => (
                <Line
                  key={row.id}
                  icon="bulb"
                  title={row.name}
                  onPress={() => router.push({ pathname: '/program/finding/[id]', params: { id: String(row.id), programme: String(programme) } })}
                  testID={`recent-finding-${row.id}`}
                />
              ))}
            </Section>
          ) : null}
        </>
      ) : (
        <StateView
          loading={programmePanel.loading || !programmePanel.error}
          error={programmePanel.error}
          onRetry={() => void programmePanel.refresh()}
          testID="discovery-panel"
        />
      )}
    </ScrollView>
  );

  const detail = current ? (
    <View style={styles.fill}>
      <Header
        back={false}
        title={t('discovery.thread.title')}
        subtitle={current.name}
        actions={
          <>
            <IconButton icon="history" label={t('discovery.home.conversations')} onPress={() => router.push(`/program/${programme}/conversations`)} />
            <IconButton icon="sparkle" label={t('discovery.thread.new')} onPress={() => openCoworker(true)} testID="coworker-new" />
          </>
        }
      />
      <CoworkerThread key={`${account}-${programme}-${conversation ?? 'new'}`} programme={programme} focusCard={focusCard} focusInput={focusInput} testID="coworker" />
    </View>
  ) : (
    <View style={[styles.fill, { backgroundColor: colors.surface2 }]} />
  );

  return (
    <SafeAreaView edges={['top', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="tab-discovery">
      <Panes list={home} detail={detail} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  strong: { fontWeight: '600' },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl, gap: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs },
  metric: { flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: '100%' },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: 6 },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingHorizontal: space.lg, paddingVertical: space.md },
  lineIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  lineText: { flex: 1, gap: 2 },
});
