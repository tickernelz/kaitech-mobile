import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../auth/session';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Icon } from '../../ui/icons';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { Chip, StateView } from '../discovery/ui';
import { getViews, loadAction, readGroups, searchRecords, specOf, type Fields, type Group, type RecordValues, type Spec, type WindowAction } from './api';
import { andDomains, defaultFilters, filtersDomain, textDomain } from './domain';
import { contextOf, domainOf, textOfValue, visible, scopeOf } from './model';
import { useFormat } from './RecordScreen';
import { Sheet } from './Sheet';
import { stash, unstash, useRecordsGeneration } from './stash';
import { actionScope, type ListStash, type RecordStash } from './useRunAction';
import { compileList, compileSearch, titleColumn, type ListSpec, type SearchSpec } from './views';

const page = 40;

type Loaded = { base: Record<string, unknown>; action: WindowAction; list: ListSpec; search: SearchSpec | null; fields: Fields; spec: Spec; formView: number | false; canCreate: boolean };

function refOf(action: WindowAction, type: string): number | false {
  const found = (action.views ?? []).find(([, kind]) => kind === type || (type === 'list' && kind === 'tree'));
  return found ? found[0] : false;
}

export function RecordListScreen({ programme, actionId, stashKey }: { programme: number; actionId?: number; stashKey?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const account = useSession().active;
  const format = useFormat();
  const generation = useRecordsGeneration();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [rows, setRows] = useState<RecordValues[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Set<string>>(new Set());
  const [onlyProgramme, setOnlyProgramme] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ label: string; domain: unknown[] } | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const asked = useRef(0);
  const uid = account?.userId ?? 0;

  useEffect(() => {
    if (!account) return;
    let live = true;
    (async () => {
      const held = unstash<ListStash>(stashKey);
      const action = held?.action ?? (actionId ? await loadAction(account, actionId, { default_engagement_id: programme }) : null);
      if (!action || action.type !== 'ir.actions.act_window') throw new Error('not a list');
      const searchRef = (action as WindowAction & { search_view_id?: [number, string] | false }).search_view_id;
      const formView = refOf(action, 'form');
      const views = await getViews(account, action.res_model, [
        [refOf(action, 'list'), 'list'],
        [formView, 'form'],
        [searchRef ? searchRef[0] : false, 'search'],
      ]);
      const fields = views.models[action.res_model]?.fields ?? {};
      const list = compileList(views.views.list.arch, fields);
      const search = views.views.search ? compileSearch(views.views.search.arch) : null;
      const formArch = views.views.form?.arch ?? '';
      const formCreate = !/<form[^>]*\screate="(false|0)"/.test(formArch);
      const base = held?.context ?? {};
      const actionContext = { ...base, ...contextOf(action.context, actionScope(base, uid, programme)) };
      if (!live) return;
      setActive(defaultFilters(search?.filters ?? [], actionContext));
      const programmeWide = fields.engagement_id?.relation === 'ck.engagement' && action.res_model !== 'ck.engagement';
      setGroupBy(search?.groupBys.find((group) => group.name && actionContext[`search_default_${group.name}`] && !(programmeWide && group.field === 'engagement_id'))?.key ?? null);
      setLoaded({ base, action, list, search, fields, spec: specOf(list.names, fields), formView, canCreate: list.create && formCreate });
    })().catch((failure: unknown) => live && setError(failure));
    return () => {
      live = false;
    };
  }, [account, actionId, stashKey, programme, uid]);

  const linked = !!loaded && loaded.fields.engagement_id?.relation === 'ck.engagement' && loaded.action.res_model !== 'ck.engagement';
  const actionContext = useMemo(() => (loaded ? { ...loaded.base, ...contextOf(loaded.action.context, actionScope(loaded.base, uid, programme)) } : {}), [loaded, uid, programme]);

  const baseDomain = useMemo(() => {
    if (!loaded) return [];
    const scope = { ...actionScope(loaded.base, uid, programme), context: actionContext };
    return andDomains([
      domainOf(loaded.action.domain, scope),
      linked && onlyProgramme ? ['|', ['engagement_id', '=', programme], ['engagement_id', '=', false]] : [],
      filtersDomain(loaded.search?.filters ?? [], active, scope),
      textDomain(loaded.search, query, scope),
    ]);
  }, [loaded, uid, actionContext, programme, linked, onlyProgramme, active, query]);
  const grouping = loaded?.search?.groupBys.find((group) => group.key === groupBy) ?? null;
  const domain = useMemo(() => andDomains([baseDomain, picked?.domain ?? []]), [baseDomain, picked]);

  useEffect(() => {
    if (!account || !loaded || !grouping || picked) return;
    let live = true;
    readGroups(account, loaded.action.res_model, baseDomain, grouping.field, actionContext)
      .then((rows) => live && setGroups(rows))
      .catch((failure: unknown) => live && setError(failure));
    return () => {
      live = false;
    };
  }, [account, loaded, grouping, picked, baseDomain, actionContext, generation]);

  const groupLabel = (group: Group): string => {
    if (!grouping || !loaded) return '';
    const value = group[grouping.field];
    if (Array.isArray(value)) return String(value[1] ?? '');
    const info = loaded.fields[grouping.field.split(':')[0]];
    if (value === false || value === null || value === undefined) return t('records.none');
    return info?.type === 'selection' ? textOfValue(info, value, format) : String(value);
  };

  const fetchPage = useCallback(
    async (offset: number) => {
      if (!account || !loaded) return;
      const ticket = (asked.current += 1);
      setLoading(true);
      try {
        const found = await searchRecords(account, loaded.action.res_model, { domain, spec: loaded.spec, offset, limit: page, order: loaded.list.order, context: actionContext });
        if (ticket !== asked.current) return;
        setTotal(found.length);
        setRows((current) => (offset ? [...current, ...found.records] : found.records));
        setError(null);
      } catch (failure) {
        if (ticket === asked.current) setError(failure);
      } finally {
        if (ticket === asked.current) setLoading(false);
      }
    },
    [account, loaded, domain, actionContext],
  );

  useEffect(() => {
    const timer = setTimeout(() => void fetchPage(0), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPage, query, generation]);

  const open = (row: RecordValues) => {
    if (!loaded) return;
    router.push({
      pathname: '/program/[id]/record',
      params: { id: String(programme), model: loaded.action.res_model, rid: String(row.id), stash: stash({ context: actionContext, formView: loaded.formView, wizard: false } satisfies RecordStash) },
    });
  };

  const create = () => {
    if (!loaded) return;
    const context = { ...actionContext, ...(linked ? { default_engagement_id: programme } : {}) };
    router.push({ pathname: '/program/[id]/record', params: { id: String(programme), model: loaded.action.res_model, rid: '', stash: stash({ context, formView: loaded.formView, wizard: false } satisfies RecordStash) } });
  };

  const toggle = (key: string) =>
    setActive((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const title = loaded?.action.name ?? '';
  const filters = loaded?.search?.filters ?? [];
  const chosen = filters.filter((filter) => active.has(filter.key));
  const titleName = loaded ? titleColumn(loaded.list) : 'display_name';
  const badge = loaded?.list.columns.find((column) => column.widget === 'badge' || column.name === 'state' || column.widget === 'statusbar');
  const others = loaded ? loaded.list.columns.filter((column) => column.name !== titleName && column !== badge).slice(0, 2) : [];
  const conditional = others.some((column) => column.invisible.length);

  const renderRow = ({ item }: { item: RecordValues }) => {
    if (!loaded) return null;
    const scope = conditional ? scopeOf(item, loaded.fields, actionContext, uid) : {};
    const name = textOfValue(loaded.fields[titleName], item[titleName], format) || String(item.display_name ?? '');
    const detail = others
      .filter((column) => visible(column.invisible, scope))
      .map((column) => textOfValue(loaded.fields[column.name], item[column.name], format, column.widget))
      .filter(Boolean)
      .join(' · ');
    const status = badge ? textOfValue(loaded.fields[badge.name], item[badge.name], format) : '';
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => open(item)}
        android_ripple={{ color: colors.select }}
        style={({ pressed }) => [styles.row, { borderColor: colors.line }, pressed && { backgroundColor: colors.surface2 }]}
        testID={`list-row-${item.id}`}>
        <View style={styles.rowText}>
          <Text variant="callout" style={styles.strong} numberOfLines={2}>
            {name}
          </Text>
          {detail ? (
            <Text variant="footnote" tone="inkSoft" numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        {status ? <Chip label={status} /> : null}
        <Icon name="forward" size={18} color={colors.inkFaint} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="list-screen">
      <Header
        title={title}
        subtitle={loaded ? t('records.total', { count: total }) : undefined}
        actions={
          <>
            {filters.length || linked || loaded?.search?.groupBys.length ? <IconButton icon="filter" label={t('records.filters')} onPress={() => setFiltering(true)} testID="list-filters" /> : null}
            {loaded?.canCreate ? <Button kind="secondary" label={t('records.add')} onPress={create} testID="list-add" /> : null}
          </>
        }
      />
      <View style={styles.search}>
        <View style={styles.searchRow}>
          <View style={styles.fill}>
            <TextField label={t('records.search')} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" testID="list-search" />
          </View>
          {query ? <IconButton icon="close" label={t('records.clear')} onPress={() => setQuery('')} testID="list-search-clear" /> : null}
        </View>
        {chosen.length || (linked && !onlyProgramme) || grouping ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {linked && !onlyProgramme ? (
              <Pressable accessibilityRole="button" onPress={() => setOnlyProgramme(true)} testID="list-chip-all">
                <Chip tone="select" label={t('records.allProgrammes')} />
              </Pressable>
            ) : null}
            {grouping ? (
              <Pressable accessibilityRole="button" accessibilityHint={t('records.removeFilter')} onPress={() => (setGroupBy(null), setPicked(null))} testID="list-chip-group">
                <Chip tone="select" label={t('records.groupedBy', { name: grouping.string })} />
              </Pressable>
            ) : null}
            {picked ? (
              <Pressable accessibilityRole="button" accessibilityHint={t('records.removeFilter')} onPress={() => setPicked(null)} testID="list-chip-picked">
                <Chip tone="select" label={picked.label} />
              </Pressable>
            ) : null}
            {chosen.map((filter) => (
              <Pressable key={filter.key} accessibilityRole="button" accessibilityHint={t('records.removeFilter')} onPress={() => toggle(filter.key)} testID={`list-chip-${filter.name}`}>
                <Chip tone="select" label={filter.string} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      {grouping && !picked && loaded ? (
        <FlashList
          data={groups ?? []}
          keyExtractor={(group, index) => `${index}-${JSON.stringify(group.__extra_domain)}`}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPicked({ label: groupLabel(item), domain: item.__extra_domain })}
              style={({ pressed }) => [styles.row, { borderColor: colors.line }, pressed && { backgroundColor: colors.surface2 }]}
              testID="list-group">
              <Text variant="callout" style={[styles.rowText, styles.strong]} numberOfLines={2}>
                {groupLabel(item)}
              </Text>
              <Text variant="footnote" tone="inkSoft">
                {item.__count}
              </Text>
              <Icon name="forward" size={18} color={colors.inkFaint} />
            </Pressable>
          )}
          ListEmptyComponent={groups ? <StateView empty={{ title: t('records.empty'), icon: 'search' }} testID="list-groups" /> : <StateView loading testID="list-groups" />}
          contentContainerStyle={styles.listContent}
        />
      ) : !loaded || (error && !rows.length) ? (
        <StateView loading={!error} error={error} onRetry={() => (setError(null), void fetchPage(0))} testID="list" />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => String(row.id)}
          renderItem={renderRow}
          onEndReached={() => {
            if (!loading && rows.length < total) void fetchPage(rows.length);
          }}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={loading && !!rows.length} onRefresh={() => void fetchPage(0)} />}
          ListEmptyComponent={loading ? <StateView loading testID="list-rows" /> : <StateView empty={{ title: t('records.empty'), icon: 'search' }} testID="list-rows" />}
          contentContainerStyle={styles.listContent}
          testID="list-rows"
        />
      )}
      {filtering && loaded ? (
        <Sheet
          title={t('records.filters')}
          onClose={() => setFiltering(false)}
          testID="list-filter-sheet"
          items={[
            ...(linked
              ? [
                  { key: 'programme', label: t('records.thisProgramme'), selected: onlyProgramme, onPress: () => setOnlyProgramme(true) },
                  { key: 'all', label: t('records.allProgrammes'), selected: !onlyProgramme, onPress: () => setOnlyProgramme(false) },
                ]
              : []),
            ...filters.map((filter) => ({ key: filter.name || filter.key, label: filter.string, selected: active.has(filter.key), onPress: () => toggle(filter.key) })),
            ...(loaded.search?.groupBys ?? []).map((group) => ({
              key: group.name || group.key,
              label: t('records.groupedBy', { name: group.string }),
              selected: groupBy === group.key,
              onPress: () => {
                setPicked(null);
                setGroupBy(groupBy === group.key ? null : group.key);
              },
            })),
          ]}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  strong: { fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  search: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm, width: '100%', maxWidth: 720, alignSelf: 'center' },
  chips: { gap: space.sm },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.md, paddingHorizontal: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, gap: 2 },
});
