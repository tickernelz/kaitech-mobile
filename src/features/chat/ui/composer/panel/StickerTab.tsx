import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { radius, space, useTheme } from '../../../../../theme';
import { Icon } from '../../../../../ui/icons';
import { Pressable } from '../../../../../ui/Pressable';
import { Text } from '../../../../../ui/Text';
import { providerStickerPage, setStickerFavorite, type StickerShelf } from '../../../composerExtras';
import type { Result } from '../../../messageActions';
import { richUrl } from '../../../rich';
import type { Sticker } from '../../../types';
import { useCookie } from '../../useCookie';
import { usePaged, useVisiblePlaying } from './paging';
import { MediaPreview } from './Preview';
import { StickerCell } from './StickerCell';
import { PanelState, Skeleton } from './states';
import { problemOf, stickerColumns, stickerRows, stickerSections, type StickerRow } from './logic';

export function StickerTab({
  shelf,
  origin,
  onPick,
  onSearching,
  onShelfChanged,
}: {
  shelf: Result<StickerShelf> | null;
  origin: string;
  onPick: (sticker: Sticker) => void;
  onSearching: (searching: boolean) => void;
  onShelfChanged: () => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const cookie = useCookie();
  const [provider, setProvider] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [preview, setPreview] = useState<Sticker | null>(null);
  const list = useRef<FlashListRef<StickerRow>>(null);
  const visible = useVisiblePlaying();
  const value = shelf?.ok ? shelf.value : null;
  const sections = useMemo(() => (value ? stickerSections(value, { favorites: t('panel.favorites'), recent: t('panel.recent') }) : []), [t, value]);
  const rows = useMemo(() => stickerRows(sections), [sections]);
  const headers = useMemo(() => rows.flatMap((row, index) => (row.type === 'header' ? [index] : [])), [rows]);
  const favorites = new Set(value?.favorites ?? []);
  const shown = provider ? 'provider' : (active ?? sections[0]?.key ?? 'provider');
  const toggleFavorite = async (sticker: Sticker) => {
    if (sticker.source !== 'pack') return;
    const result = await setStickerFavorite(sticker.id as number, !favorites.has(sticker.id as number));
    if (result.ok) onShelfChanged();
  };
  return (
    <View style={styles.fill}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sources} keyboardShouldPersistTaps="handled" accessibilityRole="tablist">
        {sections.map((section, index) => {
          const selected = section.key === shown;
          const cover = section.key.startsWith('pack-') ? section.stickers[0] : undefined;
          return (
            <Pressable
              key={section.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={section.title}
              onPress={() => {
                setProvider(false);
                setActive(section.key);
                setTimeout(() => list.current?.scrollToIndex({ index: headers[index], animated: false }), 0);
              }}
              style={[styles.source, selected && { backgroundColor: colors.select }]}
              testID={`sticker-source-${section.key}`}>
              {cover ? (
                <Image source={{ uri: cover.source === 'pack' ? richUrl(origin, cover.poster) : cover.poster, ...(cookie && cover.source === 'pack' ? { headers: cookie } : {}) }} cachePolicy="disk" style={styles.cover} accessible={false} />
              ) : (
                <Icon name={section.key === 'favorites' ? 'star' : 'clock'} size={20} color={selected ? colors.selectInk : colors.inkSoft} />
              )}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: provider }}
          accessibilityLabel={t('panel.providerStickers')}
          onPress={() => setProvider(true)}
          style={[styles.source, styles.provider, provider && { backgroundColor: colors.select }]}
          testID="sticker-source-provider">
          <Text variant="label" tone={provider ? 'selectInk' : 'inkSoft'}>
            KLIPY
          </Text>
        </Pressable>
      </ScrollView>
      {provider ? (
        <ProviderStickers onPick={onPick} onSearching={onSearching} onPreview={setPreview} />
      ) : shelf === null ? (
        <Skeleton />
      ) : !shelf.ok ? (
        <PanelState problem={problemOf(shelf) ?? 'server'} code={shelf.reason ?? shelf.code} onRetry={onShelfChanged} />
      ) : !rows.length ? (
        <PanelState problem="noStickers" />
      ) : (
        <View style={styles.fill}>
          <FlashList
            ref={list}
            data={rows}
            keyExtractor={(row, index) => (row.type === 'header' ? `h-${row.section}` : `r-${row.section}-${index}`)}
            getItemType={(row) => row.type}
            stickyHeaderIndices={headers}
            onViewableItemsChanged={(info) => {
              visible.onViewableItemsChanged(info);
              const first = info.viewableItems.find((entry) => entry.item);
              if (first?.item) setActive(first.item.section);
            }}
            viewabilityConfig={visible.viewabilityConfig}
            renderItem={({ item, index }) =>
              item.type === 'header' ? (
                <Text variant="footnote" tone="inkSoft" style={[styles.header, { backgroundColor: colors.canvas }]} accessibilityRole="header">
                  {item.title}
                </Text>
              ) : (
                <View style={styles.row}>
                  {item.stickers.map((sticker, at) => (
                    <View key={`${sticker.id}`} style={styles.quarter}>
                      <StickerCell
                        sticker={sticker}
                        origin={origin}
                        playing={visible.isPlaying(`r-${item.section}-${index}`)}
                        onPress={() => onPick(sticker)}
                        onLongPress={() => setPreview(sticker)}
                        testID={`sticker-cell-${index * stickerColumns + at}`}
                      />
                    </View>
                  ))}
                </View>
              )
            }
          />
        </View>
      )}
      <MediaPreview
        item={preview ? { sticker: preview } : null}
        origin={origin}
        favorite={preview?.source === 'pack' ? favorites.has(preview.id as number) : undefined}
        onFavorite={preview?.source === 'pack' ? () => void toggleFavorite(preview) : undefined}
        onClose={() => setPreview(null)}
        onSend={() => {
          if (preview) onPick(preview);
          setPreview(null);
        }}
      />
    </View>
  );
}

function ProviderStickers({ onPick, onSearching, onPreview }: { onPick: (sticker: Sticker) => void; onSearching: (searching: boolean) => void; onPreview: (sticker: Sticker) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [width, setWidth] = useState(0);
  const page = usePaged(providerStickerPage, query, 'sticker');
  const visible = useVisiblePlaying();
  const problem = problemOf(page.failure);
  const column = width > 0 ? (width - 4) / 2 : 0;
  return (
    <View style={styles.fill}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onFocus={() => onSearching(true)}
        onBlur={() => onSearching(false)}
        placeholder={page.attribution?.placeholder || t('panel.stickerSearch')}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={page.attribution?.placeholder || t('panel.stickerSearch')}
        style={[styles.search, { backgroundColor: colors.surface2, color: colors.ink }]}
        testID="sticker-search"
      />
      <View style={styles.fill} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {problem ? (
          <PanelState problem={problem} code={page.failure?.reason ?? page.failure?.code} onRetry={page.retry} />
        ) : page.loading && !page.items.length ? (
          <Skeleton />
        ) : !page.items.length ? (
          <PanelState problem="emptySearch" query={page.term} />
        ) : (
          <FlashList
            data={page.items}
            masonry
            optimizeItemArrangement
            numColumns={2}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            onEndReached={page.more}
            onEndReachedThreshold={0.5}
            onViewableItemsChanged={visible.onViewableItemsChanged}
            viewabilityConfig={visible.viewabilityConfig}
            renderItem={({ item, index }) => (
              <View style={{ width: column, height: Math.round(column * (item.height / item.width)) }}>
                <StickerCell sticker={item} origin="" playing={visible.isPlaying(String(item.id))} onPress={() => onPick(item)} onLongPress={() => onPreview(item)} testID={`sticker-cell-${index}`} />
              </View>
            )}
            ListFooterComponent={
              page.attribution?.mark ? (
                <Text variant="label" tone="inkFaint" style={styles.mark} testID="panel-attribution">
                  {page.attribution.mark}
                </Text>
              ) : null
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sources: { gap: space.xs, paddingVertical: space.xs },
  source: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  provider: { width: 64 },
  cover: { width: 26, height: 26 },
  header: { height: 32, lineHeight: 32, fontWeight: '600', paddingHorizontal: space.xs },
  row: { flexDirection: 'row' },
  quarter: { width: `${100 / stickerColumns}%` },
  search: { height: 40, borderRadius: radius.field, paddingHorizontal: space.md, fontSize: 16 },
  mark: { textAlign: 'center', paddingVertical: space.sm },
});
