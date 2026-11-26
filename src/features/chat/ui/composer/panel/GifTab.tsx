import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useNetworkState } from 'expo-network';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { radius, space, useTheme } from '../../../../../theme';
import { Pressable } from '../../../../../ui/Pressable';
import { Text } from '../../../../../ui/Text';
import { useChat } from '../../../chat';
import { gifCategories, gifPage, type GifCategory } from '../../../composerExtras';
import type { GifMedia } from '../../../types';
import { usePaged, useVisiblePlaying } from './paging';
import { MediaPreview } from './Preview';
import { GifCell } from './StickerCell';
import { PanelState, Skeleton } from './states';
import { problemOf } from './logic';

export function GifTab({ initialQuery, onPick, onSearching }: { initialQuery: string; onPick: (gif: GifMedia) => void; onSearching: (searching: boolean) => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const origin = useChat((state) => state.origin);
  const admin = useChat((state) => state.features.isAdmin);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<GifCategory | null>(null);
  const [categories, setCategories] = useState<GifCategory[]>([]);
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<GifMedia | null>(null);
  const search = query.trim() || category?.query || '';
  const page = usePaged(gifPage, search, 'gif');
  const visible = useVisiblePlaying();
  const network = useNetworkState();
  const problem = problemOf(page.failure);
  useEffect(() => {
    let live = true;
    void gifCategories().then((result) => live && result.ok && setCategories(result.value.categories));
    return () => {
      live = false;
    };
  }, []);
  const online = network.isConnected !== false;
  const [wasOnline, setWasOnline] = useState(online);
  if (online !== wasOnline) {
    setWasOnline(online);
    if (online && problem === 'offline') page.retry();
  }
  const column = width > 0 ? (width - 4) / 2 : 0;
  return (
    <View style={styles.fill}>
      <TextInput
        value={query}
        onChangeText={(next) => {
          setQuery(next);
          if (next.trim()) setCategory(null);
        }}
        onFocus={() => onSearching(true)}
        onBlur={() => onSearching(false)}
        placeholder={page.attribution?.placeholder || t('panel.gifSearch')}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={page.attribution?.placeholder || t('panel.gifSearch')}
        returnKeyType="search"
        style={[styles.search, { backgroundColor: colors.surface2, color: colors.ink }]}
        testID="gif-search"
      />
      {!query.trim() ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bar} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <Chip label={t('panel.trending')} selected={!category} onPress={() => setCategory(null)} testID="gif-chip-trending" />
          {categories.map((item) => (
            <Chip key={item.query} label={item.name} thumb={item.preview?.url} selected={category?.query === item.query} onPress={() => setCategory(item)} testID={`gif-chip-${item.query}`} />
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.fill} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} testID="gif-list">
        {problem ? (
          <PanelState problem={problem} code={page.failure?.reason ?? page.failure?.code} admin={admin} onRetry={page.retry} onSettings={() => void Linking.openURL(`${origin}/odoo/settings`)} />
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
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            onEndReached={page.more}
            onEndReachedThreshold={0.5}
            onViewableItemsChanged={visible.onViewableItemsChanged}
            viewabilityConfig={visible.viewabilityConfig}
            renderItem={({ item, index }) => (
              <GifCell gif={item} width={column} playing={visible.isPlaying(item.id)} label={t('rich.gif')} onPress={() => onPick(item)} onLongPress={() => setPreview(item)} testID={`gif-cell-${index}`} />
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
      <MediaPreview
        item={preview ? { gif: preview } : null}
        origin={origin}
        onClose={() => setPreview(null)}
        onSend={() => {
          if (preview) onPick(preview);
          setPreview(null);
        }}
      />
    </View>
  );
}

function Chip({ label, thumb, selected, onPress, testID }: { label: string; thumb?: string; selected: boolean; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? colors.select : colors.surface2 }]} testID={testID}>
      {thumb ? <Image source={{ uri: thumb }} cachePolicy="memory" style={styles.thumb} accessible={false} /> : null}
      <Text variant="footnote" tone={selected ? 'selectInk' : 'inkSoft'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  search: { height: 40, borderRadius: radius.field, paddingHorizontal: space.md, fontSize: 16 },
  bar: { flexGrow: 0 },
  chips: { gap: space.xs, paddingVertical: space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 32, paddingHorizontal: space.sm, borderRadius: radius.pill },
  thumb: { width: 24, height: 24, borderRadius: 12 },
  mark: { textAlign: 'center', paddingVertical: space.sm },
});
