import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, stroke, type as typography, useTheme } from '../../theme';
import { RowActions } from '../../ui/RowActions';
import { Text } from '../../ui/Text';
import { textActions } from '../../ui/textActions';
import { search, type SearchHits } from '../discovery/api';
import { openConversation, rememberProgramme, useLastProgramme } from '../discovery/store';
import { Icon, type IconName } from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { StateView } from '../discovery/ui';
import { joinChannel, preview, searchDirectory, type DirectoryHits } from './people';
import { chipHeight, chipSlop, shortfall, touchTarget } from '../../ui/touch';

type Filter = 'all' | 'chat' | 'discovery' | 'mom' | 'people';
type Hit = { key: string; icon: IconName; title: string; detail: string; open: () => void; more?: boolean };

const filters: Filter[] = ['all', 'people', 'chat', 'discovery', 'mom'];

const debounceMs = 300;
const maxLength = 64;

export function SearchScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const last = useLastProgramme(active?.id ?? null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [hits, setHits] = useState<SearchHits | null>(null);
  const [directory, setDirectory] = useState<DirectoryHits | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const words = q.trim();

  useEffect(() => {
    if (!active || !words) return;
    let current = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [found, people] = await Promise.all([search(active, words), searchDirectory(active, words).catch(() => ({ people: [], channels: [] }))]);
        if (current) {
          setHits(found);
          setDirectory(people);
          setError(null);
        }
      } catch (failure) {
        if (current) setError(failure);
      } finally {
        if (current) setLoading(false);
      }
    }, debounceMs);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [active, words]);

  const remember = (programme: number) => {
    if (active && programme) rememberProgramme(active.id, programme);
  };

  const shownHits = words ? hits : null;
  const shownPeople = words ? directory : null;
  const openChannel = async (channel: DirectoryHits['channels'][number]) => {
    if (!active) return;
    if (!channel.member && channel.type === 'channel') await joinChannel(active, channel.id).catch(() => undefined);
    router.navigate({ pathname: '/', params: { channel: String(channel.id) } });
  };
  const sections = shownHits
    ? [
        {
          key: 'people' as const,
          title: t('search.groups.people'),
          data: [
            ...(shownPeople?.people ?? []).map<Hit>((person) => ({
              key: `person-${person.partnerId}`,
              icon: 'people',
              title: person.name,
              detail: person.email || t('search.kind.person'),
              open: () => router.push({ pathname: '/person/[id]', params: { id: String(person.partnerId), name: person.name } }),
            })),
            ...(shownPeople?.channels ?? []).map<Hit>((channel) => ({
              key: `channel-${channel.id}`,
              icon: channel.type === 'group' ? 'people' : 'hash',
              title: channel.name,
              detail: channel.member ? t('search.kind.channel') : t('search.kind.channelJoin'),
              open: () => void openChannel(channel),
            })),
          ],
        },
        {
          key: 'chat' as const,
          title: t('search.groups.chat'),
          data: shownHits.chat.map<Hit>((hit) => ({
            key: `chat-${hit.message_id}`,
            icon: 'chat',
            title: hit.channel_name,
            detail: hit.author ? `${hit.author}: ${hit.text}` : hit.text,
            open: () => router.navigate({ pathname: '/', params: { channel: String(hit.channel_id), message: String(hit.message_id) } }),
          })),
        },
        {
          key: 'discovery' as const,
          title: t('search.groups.discovery'),
          data: shownHits.discovery.map<Hit>((hit) => ({
            key: `discovery-${hit.kind}-${hit.id}`,
            icon: hit.kind === 'card' ? 'decision' : hit.kind === 'conversation' ? 'sparkle' : 'doc',
            title: hit.title,
            detail: t(`search.kind.${hit.kind}`),
            open: () => {
              remember(hit.engagement_id);
              if (hit.kind === 'card') {
                router.push({ pathname: '/program/card/[id]', params: { id: String(hit.id), programme: String(hit.engagement_id) } });
              } else if (hit.kind === 'conversation') {
                if (active) openConversation(active.id, hit.engagement_id, hit.id);
                router.push({ pathname: '/program/[id]/coworker', params: { id: String(hit.engagement_id), conversation: String(hit.id) } });
              } else {
                router.navigate('/discovery');
              }
            },
          })),
        },
        {
          key: 'mom' as const,
          title: t('search.groups.mom'),
          data: shownHits.mom.map<Hit>((hit) => ({
            key: `mom-${hit.kind}-${hit.id}`,
            icon: 'meeting',
            title: hit.title,
            detail: t(`search.kind.${hit.kind}`),
            open: () => router.navigate({ pathname: '/mom', params: { [hit.kind]: String(hit.id), meeting: String(hit.meeting_id) } }),
          })),
        },
      ]
        .filter((section) => section.data.length && (filter === 'all' || filter === section.key))
        .map((section) => {
          const { shown, more } = preview(section.data, filter !== 'all');
          return more
            ? { ...section, data: [...shown, { key: `more-${section.key}`, icon: 'forward' as IconName, title: t('search.seeAll', { count: section.data.length }), detail: '', more: true, open: () => setFilter(section.key) }] }
            : section;
        })
    : [];

  const counts: Record<Exclude<Filter, 'all'>, number> = {
    people: (shownPeople?.people.length ?? 0) + (shownPeople?.channels.length ?? 0),
    chat: shownHits?.chat.length ?? 0,
    discovery: shownHits?.discovery.length ?? 0,
    mom: shownHits?.mom.length ?? 0,
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="search">
      <View style={styles.head}>
        <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.edge }]}>
          <Icon name="search" color={colors.inkSoft} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={(text) => setQ(text.slice(0, maxLength))}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel={t('search.placeholder')}
            returnKeyType="search"
            disableFullscreenUI
            maxLength={maxLength}
            selectionColor={colors.focus}
            testID="search-input"
            style={[typography.body, styles.input, { color: colors.ink }]}
          />
        </View>
        <IconButton icon="close" label={t('search.close')} onPress={() => router.back()} testID="search-close" />
      </View>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips} accessibilityRole="tablist" testID="search-filter" keyboardShouldPersistTaps="handled">
          {filters.map((value) => {
            const on = value === filter;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setFilter(value)}
                hitSlop={chipSlop}
                style={[styles.chip, { backgroundColor: on ? colors.select : colors.surface, borderColor: on ? colors.select : colors.line }]}
                testID={`search-filter-${value}`}>
                <Text variant="footnote" style={{ color: on ? colors.selectInk : colors.ink }}>
                  {value === 'all' ? t('search.all') : t('search.filter', { name: t(`search.groups.${value}`), count: counts[value] })}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          words && last ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/program/[id]/coworker', params: { id: String(last), prefill: words } })}
              testID="search-ask"
              style={({ pressed }) => [styles.ask, { backgroundColor: pressed ? colors.select : colors.surface2 }]}>
              <Icon name="sparkle" color={colors.selectInk} />
              <Text tone="selectInk" style={styles.fill} numberOfLines={2}>
                {t('search.ask', { q: words })}
              </Text>
            </Pressable>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <Text variant="label" tone="inkSoft" accessibilityRole="header" style={styles.section}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) =>
          item.more ? (
            <Pressable accessibilityRole="button" onPress={item.open} testID={`search-${item.key}`} style={({ pressed }) => [styles.more, pressed && { backgroundColor: colors.surface2 }]}>
              <Text variant="callout" tone="link">
                {item.title}
              </Text>
            </Pressable>
          ) : (
          <RowActions
            title={item.title}
            subtitle={item.detail}
            actions={[{ key: 'open', icon: 'forward', label: t('row.open'), onPress: item.open }, ...textActions(t, `${item.title}\n${item.detail}`)]}
            start={['copy']}
            end={['share', 'more']}
            testID={`search-hit-${item.key}`}>
            {(bind) => (
          <Pressable
            {...bind}
            accessibilityRole="button"
            onPress={item.open}
            testID={`search-hit-${item.key}`}
            style={({ pressed }) => [styles.hit, { backgroundColor: pressed ? colors.surface2 : colors.canvas }]}>
            <View style={[styles.hitIcon, { backgroundColor: colors.surface2 }]}>
              <Icon name={item.icon} size={20} color={colors.selectInk} />
            </View>
            <View style={styles.fill}>
              <Text variant="callout" numberOfLines={2}>
                {item.title}
              </Text>
              <Text variant="footnote" tone="inkSoft" numberOfLines={2}>
                {item.detail}
              </Text>
            </View>
          </Pressable>
            )}
          </RowActions>
          )
        }
        ListEmptyComponent={
          words ? (
            <StateView
              loading={loading && !shownHits}
              error={error}
              empty={shownHits ? { title: t('search.noneTitle'), body: t('search.noneBody') } : undefined}
              testID="search-results"
            />
          ) : (
            <StateView empty={{ title: t('search.hintTitle'), icon: 'search' }} testID="search-hint" />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  box: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg },
  input: { flex: 1, minHeight: 44 },
  filters: { paddingTop: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  chipBar: { marginTop: -shortfall(chipHeight) },
  chips: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.lg, paddingVertical: shortfall(chipHeight) },
  chip: { minHeight: chipHeight, minWidth: touchTarget, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: stroke.thin, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, paddingTop: space.lg - shortfall(chipHeight), gap: space.xs, width: '100%', maxWidth: readableWidth, alignSelf: 'center', flexGrow: 1 },
  ask: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderRadius: radius.pill, marginBottom: space.md },
  section: { paddingTop: space.md, paddingBottom: space.xs },
  hit: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderRadius: radius.md },
  more: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.md },
  hitIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
