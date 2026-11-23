import { useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { update, type Resource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { ToggleRow } from '../../ui/List';
import { RowActions } from '../../ui/RowActions';
import { textActions } from '../../ui/textActions';
import { Text } from '../../ui/Text';
import { Icon, type IconName } from '../../ui/icons';
import { setDailyBriefing, type Briefing, type BriefingItem } from '../discovery/api';
import { parseServerDate } from '../discovery/dates';
import { openConversation, rememberProgramme } from '../discovery/store';
import { Segmented, StateView, useErrorText } from '../discovery/ui';
import { offersDaily } from './rules';

type Filter = 'waiting' | 'all';

const waitingKinds = new Set(['card', 'coworker_asks', 'answer', 'chase']);

const iconOf: Record<string, IconName> = { card: 'decision', coworker_asks: 'sparkle', answer: 'chat', chase: 'history', agenda: 'bulb' };

export function activityKindKey(kind: string): string {
  return ['card', 'coworker_asks', 'answer', 'chase', 'agenda'].includes(kind) ? `activity.kind.${kind}` : 'activity.kind.other';
}

export function DiscoveryActivities({
  items,
  header,
  onScroll,
}: {
  items: Resource<Briefing>;
  header: ReactElement;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { date } = useFormatters();
  const { active } = useSession();
  const errorText = useErrorText();
  const [filter, setFilter] = useState<Filter>('waiting');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const shown = (items.data?.items ?? []).filter((item) => filter === 'all' || waitingKinds.has(item.kind));
  const daily = items.data ? offersDaily(items.data.daily) : null;

  const open = (item: BriefingItem) => {
    if (!active) return;
    rememberProgramme(active.id, item.engagement_id);
    if (item.kind === 'card' && item.packet_id) {
      router.push({
        pathname: '/program/card/[id]',
        params: {
          id: String(item.packet_id),
          programme: String(item.engagement_id),
          ...(item.conversation_id ? { conversation: String(item.conversation_id) } : {}),
        },
      });
    } else if (item.conversation_id) {
      openConversation(active.id, item.engagement_id, item.conversation_id);
      router.push({ pathname: '/program/[id]/coworker', params: { id: String(item.engagement_id), conversation: String(item.conversation_id) } });
    } else {
      router.push({ pathname: '/program/[id]/coworker', params: { id: String(item.engagement_id), prefill: t('activity.askAbout', { headline: item.headline }) } });
    }
  };

  const toggleDaily = async (on: boolean) => {
    if (!active || !items.key || saving) return;
    setSaving(true);
    setFailed(null);
    try {
      const next = await setDailyBriefing(active, on);
      update<Briefing | undefined>(items.key, (current) => (current ? { ...current, daily: next } : current));
    } catch (error) {
      setFailed(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FlatList
      data={shown}
      keyExtractor={(item, index) => `${item.kind}-${item.packet_id ?? item.conversation_id ?? item.engagement_id}-${index}`}
      contentContainerStyle={styles.list}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onRefresh={() => void items.refresh()}
      refreshing={items.loading && !!items.data}
      ListHeaderComponent={
        <View style={styles.head}>
          {header}
          <Segmented
            testID="activity-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'waiting', label: t('activity.waiting') },
              { value: 'all', label: t('activity.all') },
            ]}
          />
        </View>
      }
      renderItem={({ item, index }) => {
        const since = parseServerDate(item.since);
        return (
          <RowActions
            title={item.headline}
            subtitle={item.engagement}
            actions={[
              { key: 'open', icon: 'forward', label: t('row.open'), onPress: () => open(item) },
              {
                key: 'programme',
                icon: 'compass',
                label: t('activity.rows.programme'),
                short: t('activity.rows.programmeShort'),
                onPress: () => {
                  if (!active) return;
                  rememberProgramme(active.id, item.engagement_id);
                  router.navigate('/discovery');
                },
              },
              ...textActions(t, `${item.headline}\n${item.engagement}`),
            ]}
            start={['programme']}
            end={['copy', 'more']}
            testID={`activity-${item.kind}-${index}`}>
            {(bind) => (
              <Pressable
                {...bind}
                accessibilityRole="button"
                accessibilityLabel={[t(activityKindKey(item.kind) as never), item.headline, item.engagement, since ? date(since) : ''].filter(Boolean).join(', ')}
                onPress={() => open(item)}
                testID={`activity-${item.kind}-${index}`}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
                <View style={[styles.icon, { backgroundColor: item.kind === 'card' ? colors.warnBand : colors.surface2 }]}>
                  <Icon name={iconOf[item.kind] ?? 'bulb'} size={20} color={item.kind === 'card' ? colors.warnInk : colors.selectInk} />
                </View>
                <View style={styles.fill}>
                  <Text variant="callout">{item.headline}</Text>
                  <Text variant="footnote" tone="inkFaint" numberOfLines={1}>
                    {since ? `${item.engagement} · ${date(since)}` : item.engagement}
                  </Text>
                </View>
                <Icon name="forward" size={20} color={colors.inkFaint} />
              </Pressable>
            )}
          </RowActions>
        );
      }}
      ListEmptyComponent={
        <StateView
          loading={items.loading}
          error={items.error}
          empty={{ title: t('activity.noneTitle'), icon: 'bell' }}
          onRetry={() => void items.refresh()}
          testID="activity"
        />
      }
      ListFooterComponent={
        daily ? (
          <View style={[styles.daily, { borderColor: colors.line }]} testID="activity-daily">
            {daily === 'toggle' ? (
              <ToggleRow
                title={t('activity.daily', { channel: items.data?.daily.channel })}
                value={!!items.data?.daily.on}
                onChange={(on) => void toggleDaily(on)}
                disabled={saving}
                testID="activity-daily-toggle"
              />
            ) : (
              <Text variant="footnote" tone="inkSoft" testID="activity-daily-hint">
                {t('activity.dailyNeedsLink', { channel: items.data?.daily.channel })}
              </Text>
            )}
            {failed ? (
              <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite">
                {failed}
              </Text>
            ) : null}
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: space.lg, gap: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center', flexGrow: 1 },
  head: { gap: space.md, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, minHeight: 60 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  daily: { marginTop: space.md, padding: space.md, gap: space.xs, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
