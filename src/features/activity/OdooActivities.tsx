import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import type { Resource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/icons';
import { rememberProgramme } from '../discovery/store';
import { StateView } from '../discovery/ui';
import { ActivitySheet } from './ActivitySheet';
import { useDueLabel } from './due';
import { iconOfCategory } from './icons';
import { byModel, filtered, overviewLimit, tally, type Activity, type Filter, type Meeting, type Overview } from './odoo';
import { ScheduleSheet, type ScheduleMode } from './ScheduleSheet';

const filters: Filter[] = ['all', 'overdue', 'today', 'planned'];

export function OdooActivities({ items, header }: { items: Resource<Overview>; header: ReactElement }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const due = useDueLabel();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Activity | null>(null);
  const [form, setForm] = useState<ScheduleMode | null>(null);
  const activities = useMemo(() => items.data?.activities ?? [], [items.data]);
  const counts = useMemo(() => tally(activities), [activities]);
  const sections = useMemo(() => byModel(filtered(activities, filter), items.data?.groups ?? []), [activities, filter, items.data]);
  const meetings = items.data?.meetings ?? [];

  const changed = () => {
    setSelected(null);
    setForm(null);
    void items.refresh();
  };

  const openRecord = (model: string, id: number) => {
    if (!active) return;
    setSelected(null);
    if (model === 'discuss.channel') router.navigate({ pathname: '/', params: { channel: String(id) } });
    else if (model === 'ck.engagement') {
      rememberProgramme(active.id, id);
      router.navigate('/discovery');
    } else void Linking.openURL(`${active.origin}/odoo/${model}/${id}`);
  };

  const time = (meeting: Meeting) => {
    if (meeting.allDay) return t('activities.allDay');
    const start = new Date(meeting.start.replace(' ', 'T') + 'Z');
    return Number.isNaN(start.getTime()) ? '' : new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(start);
  };

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={(activity) => String(activity.id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        onRefresh={() => void items.refresh()}
        refreshing={items.loading && !!items.data}
        ListHeaderComponent={
          <View style={styles.head}>
            {header}
            <View style={styles.filters} accessibilityRole="tablist" testID="activities-filter">
              {filters.map((key) => {
                const on = key === filter;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setFilter(key)}
                    style={[styles.chip, { backgroundColor: on ? colors.select : colors.surface, borderColor: on ? colors.select : colors.line }]}
                    testID={`activities-filter-${key}`}>
                    <Text variant="footnote" style={{ color: on ? colors.selectInk : key === 'overdue' && counts.overdue ? colors.dangerInk : colors.ink }}>
                      {t(`activities.filter.${key}`, { count: counts[key] })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Button kind="secondary" label={t('activities.addTodo')} onPress={() => setForm({ kind: 'todo' })} testID="activities-add-todo" />
            {meetings.length ? (
              <View style={styles.block} testID="activities-meetings">
                <Text variant="callout" tone="inkSoft" accessibilityRole="header">
                  {t('activities.meetingsToday', { count: meetings.length })}
                </Text>
                {meetings.map((meeting) => (
                  <Pressable
                    key={meeting.id}
                    accessibilityRole="button"
                    onPress={() => openRecord('calendar.event', meeting.id)}
                    style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}
                    testID={`activities-meeting-${meeting.id}`}>
                    <View style={[styles.icon, { backgroundColor: colors.infoBand }]}>
                      <Icon name="meeting" size={20} color={colors.infoInk} />
                    </View>
                    <View style={styles.fill}>
                      <Text variant="callout">{meeting.name}</Text>
                      <Text variant="footnote" tone="inkFaint">
                        {time(meeting)}
                      </Text>
                    </View>
                    <Icon name="external" size={18} color={colors.inkFaint} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="callout" tone="inkSoft" accessibilityRole="header" style={styles.section} testID={`activities-section-${section.key}`}>
            {t('activities.sectionCount', { name: section.title, count: section.data.length })}
          </Text>
        )}
        renderItem={({ item }) => {
          const late = item.state === 'overdue';
          const when = due(item.deadline);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={[item.summary || item.typeName, item.resName, when].filter(Boolean).join(', ')}
              onPress={() => setSelected(item)}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}
              testID={`activity-odoo-${item.id}`}>
              <View style={[styles.icon, { backgroundColor: late ? colors.dangerBand : colors.surface2 }]}>
                <Icon name={iconOfCategory(item.category)} size={20} color={late ? colors.dangerInk : colors.selectInk} />
              </View>
              <View style={styles.fill}>
                <Text variant="callout" numberOfLines={2}>
                  {item.summary || item.typeName}
                </Text>
                <Text variant="footnote" numberOfLines={1} style={{ color: late ? colors.dangerInk : colors.inkFaint }}>
                  {item.resName ? `${when} · ${item.resName}` : when}
                </Text>
              </View>
              <Icon name="forward" size={20} color={colors.inkFaint} />
            </Pressable>
          );
        }}
        ListFooterComponent={
          items.data?.truncated ? (
            <Text variant="footnote" tone="inkSoft" style={styles.footer} testID="activities-truncated">
              {t('activities.truncated', { count: overviewLimit })}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <StateView
            loading={items.loading}
            error={items.error}
            empty={{ title: filter === 'all' ? t('activities.noneTitle') : t('activities.noneFiltered'), icon: 'check' }}
            onRetry={() => void items.refresh()}
            testID="activities"
          />
        }
      />
      {selected ? (
        <ActivitySheet
          activity={selected}
          onClose={() => setSelected(null)}
          onChanged={changed}
          onEdit={() => {
            setForm({ kind: 'edit', activity: selected });
            setSelected(null);
          }}
          onNext={(next) => {
            setSelected(null);
            void items.refresh();
            setForm({ kind: 'record', resModel: next.resModel, resId: next.resId, resName: selected.resName, previousTypeId: next.previousTypeId });
          }}
          onOpenRecord={() => openRecord(selected.resModel, selected.resId)}
        />
      ) : null}
      {form ? <ScheduleSheet mode={form} onClose={() => setForm(null)} onSaved={changed} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: space.lg, gap: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center', flexGrow: 1 },
  head: { gap: space.md, paddingBottom: space.sm },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  block: { gap: space.sm },
  footer: { paddingTop: space.md, textAlign: 'center' },
  section: { paddingTop: space.md, paddingBottom: space.xs, paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, marginBottom: space.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
