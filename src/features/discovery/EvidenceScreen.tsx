import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { update, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { Panes } from '../../layout/Panes';
import { readableWidth, useWindowClass } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { evidencePage, evidence as readEvidence, findings as readFindings, programmes, type Evidence, type EvidenceKind, type Finding } from './api';
import { parseServerDate } from './dates';
import { findingTone, FindingView } from './FindingView';
import { Header } from './Header';
import { sourceIcon, sourceLabelKey } from './sources';
import { Icon } from '../../ui/icons';
import { Chip, Segmented, StateView } from './ui';

type View_ = 'findings' | 'evidence';

const exhausted = new Set<string>();

function usePagedEvidence(programme: number, kind: EvidenceKind) {
  const { active } = useSession();
  const first = useResource(`discovery.evidence.${programme}.${kind}`, (account) => readEvidence(account, programme, kind));
  const [extending, setExtending] = useState(false);
  const rows = first.data ?? [];
  const more = useCallback(async () => {
    const key = first.key;
    if (!active || !key || extending || first.loading || exhausted.has(key) || !rows.length) return;
    setExtending(true);
    try {
      const page = await readEvidence(active, programme, kind, rows.length);
      if (page.length < evidencePage) exhausted.add(key);
      update<Evidence[]>(key, (current) => [...(current ?? []), ...page.filter((row) => !current?.some((seen) => seen.id === row.id))]);
    } finally {
      setExtending(false);
    }
  }, [active, first.key, first.loading, extending, rows.length, programme, kind]);
  const reload = useCallback(() => {
    if (first.key) exhausted.delete(first.key);
    return first.refresh();
  }, [first]);
  return { rows, loading: first.loading || extending, error: first.error, more, reload };
}

function EvidenceRow({ row }: { row: Evidence }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { date } = useFormatters();
  const at = parseServerDate(row.stated_at);
  const used = row.question_ids.length;
  return (
    <View style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.line }]} testID={`evidence-${row.id}`}>
      <Text selectable>
        {'\u201C'}
        {row.quote}
        {'\u201D'}
      </Text>
      <View style={styles.meta}>
        <Icon name={sourceIcon(row.source_kind)} size={16} color={colors.inkSoft} />
        <Text variant="footnote" tone="inkSoft" style={styles.fill}>
          {[
            t(sourceLabelKey(row.source_kind) as never) as string,
            row.source_text_id ? row.source_text_id[1] : '',
            row.stated_by_profile_id ? row.stated_by_profile_id[1] : '',
            at ? date(at) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <View style={styles.chips}>
        {row.conflict ? <Chip tone="warn" label={t('discovery.evidence.conflict')} /> : null}
        {used ? <Chip tone="ok" label={t('discovery.evidence.used', { count: used })} /> : <Chip label={t('discovery.evidence.unused')} />}
      </View>
    </View>
  );
}

function FindingRow({ row, selected, onPress }: { row: Finding; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={`finding-${row.id}`}
      style={({ pressed }) => [
        styles.item,
        { backgroundColor: selected || pressed ? colors.select : colors.surface, borderColor: selected ? colors.primary : colors.line },
      ]}>
      <View style={styles.chips}>
        <Chip tone={findingTone(row)} label={t(`discovery.finding.kind.${row.kind}` as never, { defaultValue: row.kind }) as string} />
        {row.state === 'accepted' ? <Chip tone="ok" label={t('discovery.finding.state.accepted')} /> : null}
      </View>
      <Text variant="headline">{row.name}</Text>
      <Text variant="footnote" tone="inkSoft" numberOfLines={2}>
        {row.body}
      </Text>
      <Text variant="footnote" tone="inkFaint">
        {t('discovery.finding.sides', { count: row.side_ids.length })}
      </Text>
    </Pressable>
  );
}

export function EvidenceScreen({ programme, initial = 'findings' }: { programme: number; initial?: View_ }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { windowClass } = useWindowClass();
  const expanded = windowClass === 'expanded';
  const [view, setView] = useState<View_>(initial);
  const [kind, setKind] = useState<EvidenceKind>('all');
  const [selected, setSelected] = useState<number | null>(null);
  const names = useResource('discovery.programmes', programmes, 60_000);
  const name = names.data?.find((row) => row.id === programme)?.name ?? '';
  const found = useResource(`discovery.findings.${programme}`, (account) => readFindings(account, programme));
  const paged = usePagedEvidence(programme, kind);
  const current = selected ?? (expanded ? (found.data?.[0]?.id ?? null) : null);

  const header = (
    <View style={styles.filters}>
      <Segmented
        testID="evidence-view"
        value={view}
        onChange={setView}
        options={[
          { value: 'findings', label: t('discovery.home.findings') },
          { value: 'evidence', label: t('discovery.home.evidence') },
        ]}
      />
      {view === 'evidence' ? (
        <Segmented
          testID="evidence-kind"
          value={kind}
          onChange={setKind}
          options={(['all', 'interview', 'document', 'meeting', 'other'] as EvidenceKind[]).map((value) => ({
            value,
            label: t(`discovery.evidence.filter.${value}`),
          }))}
        />
      ) : null}
    </View>
  );

  const list =
    view === 'findings' ? (
      <FlatList
        data={found.data ?? []}
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <FindingRow
            row={item}
            selected={expanded && item.id === current}
            onPress={() => (expanded ? setSelected(item.id) : router.push({ pathname: '/program/finding/[id]', params: { id: String(item.id), programme: String(programme) } }))}
          />
        )}
        onRefresh={() => void found.refresh()}
        refreshing={found.loading && !!found.data}
        ListEmptyComponent={
          <StateView
            loading={found.loading}
            error={found.error}
            empty={{ title: t('discovery.finding.noneTitle'), icon: 'bulb' }}
            onRetry={() => void found.refresh()}
          />
        }
      />
    ) : (
      <FlatList
        data={paged.rows}
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => <EvidenceRow row={item} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => void paged.more()}
        onRefresh={() => void paged.reload()}
        refreshing={paged.loading && paged.rows.length > 0}
        ListEmptyComponent={
          <StateView
            loading={paged.loading}
            error={paged.error}
            empty={{ title: t('discovery.evidence.noneTitle'), icon: 'doc' }}
            onRetry={() => void paged.reload()}
          />
        }
      />
    );

  const detail = current ? (
    <FindingView key={current} id={current} programme={programme} />
  ) : (
    <View style={[styles.fill, { backgroundColor: colors.surface2 }]} />
  );

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="evidence-screen">
      <Header title={t('discovery.home.evidenceAndFindings')} subtitle={name} />
      <View style={styles.fill}>
        {view === 'findings' ? <Panes list={list} detail={detail} /> : list}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  filters: { gap: space.xs, paddingBottom: space.sm },
  list: { padding: space.lg, gap: space.md, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  item: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
