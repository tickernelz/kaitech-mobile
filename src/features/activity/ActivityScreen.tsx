import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { readableWidth } from '../../layout/windowClass';
import { HeaderActions } from '../../screens/HeaderActions';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { briefing, type BriefingItem } from '../discovery/api';
import { parseServerDate } from '../discovery/dates';
import { openConversation, rememberProgramme } from '../discovery/store';
import { Icon, type IconName } from '../../ui/icons';
import { Segmented, StateView } from '../discovery/ui';

type Filter = 'waiting' | 'all';

const waitingKinds = new Set(['card', 'coworker_asks', 'answer', 'chase']);

const iconOf: Record<string, IconName> = { card: 'decision', coworker_asks: 'sparkle', answer: 'chat', chase: 'history', agenda: 'bulb' };

export function activityKindKey(kind: string): string {
  return ['card', 'coworker_asks', 'answer', 'chase', 'agenda'].includes(kind) ? `activity.kind.${kind}` : 'activity.kind.other';
}

export function ActivityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { date } = useFormatters();
  const { active } = useSession();
  const [filter, setFilter] = useState<Filter>('waiting');
  const items = useResource('activity.discovery', briefing, 30_000);
  const shown = (items.data ?? []).filter((item) => filter === 'all' || waitingKinds.has(item.kind));

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
      router.navigate('/discovery');
    }
  };

  return (
    <SafeAreaView edges={['top', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="tab-activity">
      <FlatList
        data={shown}
        keyExtractor={(item, index) => `${item.kind}-${item.packet_id ?? item.conversation_id ?? item.engagement_id}-${index}`}
        contentContainerStyle={styles.list}
        onRefresh={() => void items.refresh()}
        refreshing={items.loading && !!items.data}
        ListHeaderComponent={
          <View style={styles.head}>
            <View style={styles.top}>
              <Text variant="display" accessibilityRole="header" style={styles.fill}>
                {t('tabs.activity')}
              </Text>
              <HeaderActions />
            </View>
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
            <Pressable
              accessibilityRole="button"
              onPress={() => open(item)}
              testID={`activity-${item.kind}-${index}`}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
              <View style={[styles.icon, { backgroundColor: item.kind === 'card' ? colors.warnBand : colors.surface2 }]}>
                <Icon name={iconOf[item.kind] ?? 'bulb'} size={20} color={item.kind === 'card' ? colors.warnInk : colors.selectInk} />
              </View>
              <View style={styles.fill}>
                <Text variant="label" tone="inkSoft">
                  {t(activityKindKey(item.kind) as never)} · {item.engagement}
                </Text>
                <Text variant="callout">{item.headline}</Text>
                {since ? (
                  <Text variant="footnote" tone="inkFaint">
                    {date(since)}
                  </Text>
                ) : null}
              </View>
              <Icon name="forward" size={20} color={colors.inkFaint} />
            </Pressable>
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: space.lg, gap: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center', flexGrow: 1 },
  head: { gap: space.md, paddingBottom: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 60,
  },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
