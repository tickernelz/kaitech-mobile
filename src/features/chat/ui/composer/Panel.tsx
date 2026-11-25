import { FlashList } from '@shopify/flash-list';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import { Icon, type IconName } from '../../../../ui/icons';
import { Pressable } from '../../../../ui/Pressable';
import { Text } from '../../../../ui/Text';
import { gifPage, providerStickerPage, stickerShelf, type Attribution, type Page, type StickerShelf } from '../../composerExtras';
import type { Result } from '../../messageActions';
import { richUrl } from '../../rich';
import type { GifMedia, Sticker } from '../../types';
import { failureText } from '../actions/failure';
import { EmojiGrid } from '../EmojiPicker';
import { useCookie } from '../useCookie';

export type PanelTab = 'emoji' | 'sticker' | 'gif';
export const panelTabs: PanelTab[] = ['emoji', 'sticker', 'gif'];

const tabIcons: Record<PanelTab, IconName | null> = { emoji: 'emoji', sticker: 'sticker', gif: null };
const searchDelay = 350;

export function ComposerPanel({
  origin,
  onEmoji,
  onBackspace,
  onSticker,
  onGif,
  onSearching,
}: {
  origin: string;
  onEmoji: (emoji: string) => void;
  onBackspace: () => void;
  onSticker: (sticker: Sticker) => void;
  onGif: (gif: GifMedia) => void;
  onSearching: (searching: boolean) => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [tab, setTab] = useState<PanelTab>('emoji');
  return (
    <View style={[styles.panel, { backgroundColor: colors.canvas }]} testID="composer-panel">
      <View style={styles.content}>
        {tab === 'emoji' ? (
          <EmojiGrid
            onPick={onEmoji}
            onSearching={onSearching}
            style={styles.fill}
            trailing={
              <Pressable accessibilityRole="button" accessibilityLabel={t('panel.backspace')} onPress={onBackspace} style={styles.square} testID="panel-backspace">
                <Icon name="backspace" color={colors.inkSoft} />
              </Pressable>
            }
          />
        ) : tab === 'sticker' ? (
          <StickerTab origin={origin} onPick={onSticker} onSearching={onSearching} />
        ) : (
          <GifTab onPick={onGif} onSearching={onSearching} />
        )}
      </View>
      <View style={[styles.tabs, { borderTopColor: colors.line }]} accessibilityRole="tablist">
        {panelTabs.map((key) => {
          const selected = key === tab;
          const icon = tabIcons[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={t(`panel.${key}`)}
              accessibilityState={{ selected }}
              onPress={() => setTab(key)}
              style={[styles.tab, selected && { backgroundColor: colors.select }]}
              testID={`panel-tab-${key}`}>
              {icon ? (
                <Icon name={icon} color={selected ? colors.selectInk : colors.inkSoft} />
              ) : (
                <Text variant="footnote" style={[styles.gifTab, { color: selected ? colors.selectInk : colors.inkSoft }]}>
                  GIF
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useDebounced(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), searchDelay);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

type Loaded<T> = { key: string; term: string; items: T[]; next: string | null; attribution: Attribution | null; failure: string | null };

function usePaged<T>(load: (query: string, position: string | null) => Promise<Result<Page<T>>>, query: string) {
  const { t } = useTranslation('chat');
  const term = useDebounced(query.trim());
  const [after, setAfter] = useState<{ term: string; position: string } | null>(null);
  const position = after?.term === term ? after.position : null;
  const key = term + '|' + (position ?? '');
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  useEffect(() => {
    let live = true;
    void load(term, position).then((result) => {
      if (!live) return;
      setLoaded((current) => {
        const before = position && current?.term === term ? current : null;
        if (!result.ok) return { key, term, items: before?.items ?? [], next: before?.next ?? null, attribution: before?.attribution ?? null, failure: failureText(t, result) };
        return { key, term, items: [...(before?.items ?? []), ...result.value.items], next: result.value.next, attribution: result.value.attribution ?? before?.attribution ?? null, failure: null };
      });
    });
    return () => {
      live = false;
    };
  }, [key, load, position, t, term]);
  const loading = loaded?.key !== key;
  const same = loaded?.term === term;
  const items = same ? loaded.items : [];
  const next = same ? loaded.next : null;
  const failure = !loading && loaded ? loaded.failure : null;
  const more = () => {
    if (!loading && next && !failure) setAfter({ term, position: next });
  };
  return { items, next, attribution: loaded?.attribution ?? null, loading, failure, more };
}

function SearchField({ value, onChange, placeholder, onSearching, testID }: { value: string; onChange: (value: string) => void; placeholder: string; onSearching: (searching: boolean) => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onFocus={() => onSearching(true)}
      onBlur={() => onSearching(false)}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      accessibilityLabel={placeholder}
      returnKeyType="search"
      style={[styles.search, { backgroundColor: colors.surface2, color: colors.ink }]}
      testID={testID}
    />
  );
}

function Status({ loading, failure, empty, emptyText }: { loading: boolean; failure: string | null; empty: boolean; emptyText: string }) {
  const { colors } = useTheme();
  if (failure)
    return (
      <Text variant="callout" tone="dangerInk" style={styles.status} testID="panel-failure">
        {failure}
      </Text>
    );
  if (loading && empty) return <ActivityIndicator color={colors.primary} style={styles.status} />;
  if (empty)
    return (
      <Text variant="callout" tone="inkSoft" style={styles.status} testID="panel-empty">
        {emptyText}
      </Text>
    );
  return null;
}

function Mark({ attribution }: { attribution: Attribution | null }) {
  if (!attribution?.mark) return null;
  return (
    <Text variant="label" tone="inkFaint" style={styles.mark} testID="panel-attribution">
      {attribution.mark}
    </Text>
  );
}

function GifTab({ onPick, onSearching }: { onPick: (gif: GifMedia) => void; onSearching: (searching: boolean) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const page = usePaged(gifPage, query);
  return (
    <View style={styles.fill}>
      <SearchField value={query} onChange={setQuery} placeholder={page.attribution?.placeholder || t('panel.gifSearch')} onSearching={onSearching} testID="gif-search" />
      <View style={styles.fill}>
        {page.items.length ? (
          <FlashList
            data={page.items}
            numColumns={2}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            onEndReached={page.more}
            onEndReachedThreshold={0.5}
            renderItem={({ item, index }) => {
              const still = item.preview ?? item.gif ?? item.mp4;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={item.title || t('rich.gif')} onPress={() => onPick(item)} style={styles.gifCell} testID={`gif-cell-${index}`}>
                  <Image source={{ uri: still?.url }} style={[styles.gifImage, { backgroundColor: colors.surface2 }]} resizeMode="cover" />
                </Pressable>
              );
            }}
          />
        ) : (
          <Status loading={page.loading} failure={page.failure} empty emptyText={t('panel.none')} />
        )}
      </View>
      <Mark attribution={page.attribution} />
    </View>
  );
}

type Source = 'recent' | 'provider' | number;

function StickerTab({ origin, onPick, onSearching }: { origin: string; onPick: (sticker: Sticker) => void; onSearching: (searching: boolean) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const cookie = useCookie();
  const [shelf, setShelf] = useState<Result<StickerShelf> | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  useEffect(() => {
    let live = true;
    void stickerShelf().then((result) => {
      if (!live) return;
      setShelf(result);
      if (result.ok) setSource((current) => current ?? (result.value.recent.length ? 'recent' : result.value.packs[0]?.id ?? 'provider'));
      else setSource((current) => current ?? 'provider');
    });
    return () => {
      live = false;
    };
  }, []);
  const packs = shelf?.ok ? shelf.value.packs : [];
  const recent = shelf?.ok ? shelf.value.recent : [];
  const sources: Source[] = [...(recent.length ? (['recent'] as const) : []), ...packs.map((pack) => pack.id), 'provider'];
  const shown = source === 'recent' ? recent : typeof source === 'number' ? (packs.find((pack) => pack.id === source)?.stickers ?? []) : [];
  return (
    <View style={styles.fill}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sources} keyboardShouldPersistTaps="handled">
        {sources.map((key) => {
          const selected = key === source;
          const pack = typeof key === 'number' ? packs.find((item) => item.id === key) : undefined;
          const cover = pack?.stickers[0];
          return (
            <Pressable
              key={String(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={key === 'recent' ? t('panel.recent') : key === 'provider' ? t('panel.providerStickers') : pack?.name}
              onPress={() => setSource(key)}
              style={[styles.source, selected && { backgroundColor: colors.select }]}
              testID={`sticker-source-${key}`}>
              {cover ? (
                <Image source={{ uri: richUrl(origin, cover.poster), ...(cookie ? { headers: cookie } : {}) }} style={styles.sourceImage} />
              ) : (
                <Icon name={key === 'recent' ? 'clock' : 'search'} color={selected ? colors.selectInk : colors.inkSoft} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {source === 'provider' ? (
        <ProviderStickers onPick={onPick} onSearching={onSearching} />
      ) : (
        <View style={styles.fill}>
          {shown.length ? (
            <StickerGrid stickers={shown} origin={origin} onPick={onPick} />
          ) : (
            <Status loading={shelf === null} failure={shelf && !shelf.ok ? failureText(t, shelf) : null} empty emptyText={t('panel.noStickers')} />
          )}
        </View>
      )}
    </View>
  );
}

function ProviderStickers({ onPick, onSearching }: { onPick: (sticker: Sticker) => void; onSearching: (searching: boolean) => void }) {
  const { t } = useTranslation('chat');
  const [query, setQuery] = useState('');
  const page = usePaged(providerStickerPage, query);
  return (
    <View style={styles.fill}>
      <SearchField value={query} onChange={setQuery} placeholder={page.attribution?.placeholder || t('panel.stickerSearch')} onSearching={onSearching} testID="sticker-search" />
      <View style={styles.fill}>
        {page.items.length ? <StickerGrid stickers={page.items} origin="" onPick={onPick} onEnd={page.more} /> : <Status loading={page.loading} failure={page.failure} empty emptyText={t('panel.none')} />}
      </View>
      <Mark attribution={page.attribution} />
    </View>
  );
}

function StickerGrid({ stickers, origin, onPick, onEnd }: { stickers: Sticker[]; origin: string; onPick: (sticker: Sticker) => void; onEnd?: () => void }) {
  const cookie = useCookie();
  return (
    <FlashList
      data={stickers}
      numColumns={4}
      keyExtractor={(item) => String(item.id)}
      keyboardShouldPersistTaps="handled"
      onEndReached={onEnd}
      onEndReachedThreshold={0.5}
      renderItem={({ item, index }) => {
        const own = item.source === 'pack';
        return (
          <Pressable accessibilityRole="button" accessibilityLabel={item.alt} onPress={() => onPick(item)} style={styles.stickerCell} testID={`sticker-cell-${index}`}>
            <Image source={{ uri: own ? richUrl(origin, item.poster) : item.poster, ...(own && cookie ? { headers: cookie } : {}) }} style={styles.stickerImage} resizeMode="contain" />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  content: { flex: 1, paddingHorizontal: space.sm, paddingTop: space.sm },
  fill: { flex: 1, gap: space.xs },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: space.xs },
  tab: { minWidth: 56, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  gifTab: { fontWeight: '700', letterSpacing: 0.5 },
  square: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 44, borderRadius: radius.field, paddingHorizontal: space.md, fontSize: 16 },
  status: { textAlign: 'center', padding: space.xl },
  mark: { textAlign: 'center', paddingVertical: 2 },
  gifCell: { flex: 1, padding: 2 },
  gifImage: { width: '100%', height: 112, borderRadius: radius.sm },
  sources: { gap: space.xs, paddingBottom: space.xs },
  source: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sourceImage: { width: 32, height: 32 },
  stickerCell: { flex: 1, aspectRatio: 1, padding: space.xs, alignItems: 'center', justifyContent: 'center' },
  stickerImage: { width: '100%', height: '100%' },
});
