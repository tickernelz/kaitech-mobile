import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, type as typography, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { search, type SearchHits } from '../discovery/api';
import { openConversation, rememberProgramme, useLastProgramme } from '../discovery/store';
import { Icon, type IconName } from '../../ui/icons';
import { IconButton, Segmented, StateView } from '../discovery/ui';

type Filter = 'all' | 'chat' | 'discovery' | 'mom';
type Hit = { key: string; icon: IconName; title: string; detail: string; open: () => void };

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
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const words = q.trim();

  useEffect(() => {
    if (!active || !words) return;
    let current = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await search(active, words);
        if (current) {
          setHits(found);
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
  const sections = shownHits
    ? [
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
      ].filter((section) => section.data.length && (filter === 'all' || filter === section.key))
    : [];

  const counts = { chat: shownHits?.chat.length ?? 0, discovery: shownHits?.discovery.length ?? 0, mom: shownHits?.mom.length ?? 0 };

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
        <Segmented
          testID="search-filter"
          value={filter}
          onChange={setFilter}
          options={(['all', 'chat', 'discovery', 'mom'] as Filter[]).map((value) => ({
            value,
            label: value === 'all' ? t('search.all') : t('search.filter', { name: t(`search.groups.${value}`), count: counts[value] }),
          }))}
        />
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
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={item.open}
            testID={`search-hit-${item.key}`}
            style={({ pressed }) => [styles.hit, pressed && { backgroundColor: colors.surface2 }]}>
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
  filters: { paddingHorizontal: space.lg, paddingTop: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  list: { padding: space.lg, gap: space.xs, width: '100%', maxWidth: readableWidth, alignSelf: 'center', flexGrow: 1 },
  ask: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderRadius: radius.pill, marginBottom: space.md },
  section: { paddingTop: space.md, paddingBottom: space.xs },
  hit: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderRadius: radius.md },
  hitIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
