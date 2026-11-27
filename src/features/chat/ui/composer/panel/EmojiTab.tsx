import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';
import { Overlay } from '../../../../../ui/Overlay';
import { radius, space, useTheme } from '../../../../../theme';
import { Icon, type IconName } from '../../../../../ui/icons';
import { Pressable } from '../../../../../ui/Pressable';
import { Text } from '../../../../../ui/Text';
import { noteEmoji, recentEmoji, rememberSkin, searchEmoji, skinFor, skinTones, supportsSkin, withSkin } from '../../../emoji/emoji';
import type { Sticker } from '../../../types';
import { StickerCell } from './StickerCell';
import { emojiColumns, emojiRows, type EmojiRow, type EmojiSection } from './logic';
import { useWhenPanelShows } from './paging';
import { reachBelow, touchTarget } from '../../../../../ui/touch';

const toneLabels = ['panel.tone0', 'panel.tone1', 'panel.tone2', 'panel.tone3', 'panel.tone4', 'panel.tone5'] as const;
const cellSize = 46;
const categoryWidth = 36;
const categoryHeight = 32;
const categorySlop = reachBelow(categoryHeight, space.xs);
const headerHeight = 32;
const holdMs = 420;

const sectionIcons: Record<EmojiSection, IconName> = {
  recent: 'clock',
  smileys: 'catSmileys',
  people: 'catPeople',
  nature: 'catNature',
  food: 'catFood',
  travel: 'catTravel',
  activities: 'catActivities',
  objects: 'catObjects',
  symbols: 'catSymbols',
};

export function EmojiTab({
  onPick,
  onBackspace,
  onSearching,
  stickers,
  origin,
  onSticker,
  onSearchGif,
}: {
  onPick: (emoji: string) => void;
  onBackspace: () => void;
  onSearching: (searching: boolean) => void;
  stickers: Sticker[];
  origin: string;
  onSticker: (sticker: Sticker) => void;
  onSearchGif: (query: string) => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [recent, setRecent] = useState(recentEmoji);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<EmojiSection | null>(null);
  const [tones, setTones] = useState<{ emoji: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useWhenPanelShows(
    () => setRecent((current) => (current.join(' ') === recentEmoji().join(' ') ? current : recentEmoji())),
    () => {
      setQuery('');
      setTones(null);
      setPreview(null);
    },
  );
  const list = useRef<FlashListRef<EmojiRow>>(null);
  const rows = useMemo(() => emojiRows(recent), [recent]);
  const headers = useMemo(() => rows.flatMap((row, index) => (row.type === 'header' ? [index] : [])), [rows]);
  const sections = useMemo(() => headers.map((index) => rows[index].section), [headers, rows]);
  const term = query.trim();
  const results = useMemo(() => (term ? searchEmoji(term) : []), [term]);
  const stickerHits = useMemo(() => {
    if (!term) return [];
    const lower = term.toLowerCase();
    return stickers.filter((sticker) => sticker.alt.toLowerCase().includes(lower)).slice(0, 4);
  }, [stickers, term]);
  const shown = active ?? sections[0] ?? null;

  const pick = (emoji: string) => {
    const toned = withSkin(emoji, skinFor(emoji));
    noteEmoji(toned);
    onPick(toned);
  };
  const hold = (emoji: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    if (supportsSkin(emoji)) setTones({ emoji });
    else setPreview(emoji);
  };

  const cell = (emoji: string, index: number, key: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={emoji}
      accessibilityHint={supportsSkin(emoji) ? t('panel.skinHint') : undefined}
      onPress={() => pick(emoji)}
      onLongPress={() => hold(emoji)}
      onPressOut={() => setPreview(null)}
      delayLongPress={holdMs}
      style={styles.cell}
      testID={`emoji-cell-${index}`}>
      <Text style={styles.glyph}>{withSkin(emoji, skinFor(emoji))}</Text>
      {supportsSkin(emoji) ? <View style={[styles.skinMark, { borderBottomColor: colors.inkFaint }]} /> : null}
      {preview === emoji ? (
        <View pointerEvents="none" style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={styles.previewGlyph}>{emoji}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.fill}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => onSearching(true)}
          onBlur={() => onSearching(false)}
          placeholder={t('emoji.search')}
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={t('emoji.search')}
          style={[styles.search, { backgroundColor: colors.surface2, color: colors.ink }]}
          testID="emoji-search"
        />
        <Pressable accessibilityRole="button" accessibilityLabel={t('panel.backspace')} onPress={onBackspace} style={styles.square} testID="panel-backspace">
          <Icon name="backspace" color={colors.inkSoft} />
        </Pressable>
      </View>
      {term ? (
        <View style={styles.fill} testID="emoji-results">
          {results.length ? (
            <View style={styles.grid}>{results.map((emoji, index) => cell(emoji, index, emoji))}</View>
          ) : (
            <Text variant="callout" tone="inkSoft" style={styles.none} testID="emoji-none">
              {t('panel.noEmoji', { query: term })}
            </Text>
          )}
          {stickerHits.length ? (
            <>
              <Text variant="footnote" tone="inkSoft" style={styles.header}>
                {t('panel.kaitechStickers')}
              </Text>
              <View style={styles.stickerRow}>
                {stickerHits.map((sticker) => (
                  <StickerCell size={64} key={String(sticker.id)} sticker={sticker} origin={origin} onPress={() => onSticker(sticker)} />
                ))}
              </View>
            </>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => onSearchGif(term)} style={styles.gifRow} testID="emoji-search-gif">
            <Icon name="search" size={20} color={colors.inkSoft} />
            <Text variant="callout" tone="link" numberOfLines={1}>
              {t('panel.searchGif', { query: term })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.categories} accessibilityRole="tablist">
            {sections.map((section, index) => {
              const selected = section === shown;
              return (
                <Pressable
                  key={section}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(`emoji.category.${section}`)}
                  onPress={() => {
                    setActive(section);
                    list.current?.scrollToIndex({ index: headers[index], animated: false });
                  }}
                  hitSlop={categorySlop}
                  style={styles.category}
                  testID={`emoji-tab-${section}`}>
                  <View style={[styles.categoryMark, selected && { backgroundColor: colors.select }]}>
                    <Icon name={sectionIcons[section]} size={20} color={selected ? colors.selectInk : colors.inkSoft} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.fill}>
            <FlashList
              ref={list}
              data={rows}
              keyExtractor={(row, index) => (row.type === 'header' ? `h-${row.section}` : `r-${row.section}-${index}`)}
              getItemType={(row) => row.type}
              stickyHeaderIndices={headers}
              keyboardShouldPersistTaps="handled"
              onViewableItemsChanged={({ viewableItems }) => {
                const first = viewableItems.find((entry) => entry.item);
                if (first?.item) setActive(first.item.section);
              }}
              renderItem={({ item, index }) =>
                item.type === 'header' ? (
                  <Text variant="footnote" tone="inkSoft" style={[styles.header, { backgroundColor: colors.canvas }]} accessibilityRole="header">
                    {t(`emoji.category.${item.section}`)}
                  </Text>
                ) : (
                  <View style={styles.row}>{item.emojis.map((emoji, at) => cell(emoji, index * emojiColumns + at, `${index}-${at}`))}</View>
                )
              }
              testID="emoji-list"
            />
          </View>
        </>
      )}
      <Overlay visible={tones !== null} transparent animationType="fade" onRequestClose={() => setTones(null)}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={() => setTones(null)} accessibilityRole="button" accessibilityLabel={t('panel.closeTones')}>
          {tones ? (
            <View style={[styles.tones, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="emoji-tones">
              {skinTones.map((_, tone) => (
                <Pressable
                  key={tone}
                  accessibilityRole="button"
                  accessibilityLabel={t(toneLabels[tone])}
                  onPress={() => {
                    rememberSkin(tones.emoji, tone);
                    const toned = withSkin(tones.emoji, tone);
                    noteEmoji(toned);
                    onPick(toned);
                    setTones(null);
                    setRecent(recentEmoji());
                  }}
                  style={styles.tone}
                  testID={`emoji-tone-${tone}`}>
                  <Text style={styles.glyph}>{withSkin(tones.emoji, tone)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Overlay>
    </View>
  );
}


const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  search: { flex: 1, height: touchTarget, borderRadius: radius.field, paddingHorizontal: space.md, fontSize: 16 },
  square: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  categories: { flexDirection: 'row', paddingTop: categorySlop.top, paddingBottom: categorySlop.bottom },
  category: { flex: 1, height: categoryHeight, alignItems: 'center', justifyContent: 'center' },
  categoryMark: { width: categoryWidth, height: categoryHeight, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  header: { height: headerHeight, lineHeight: headerHeight, fontWeight: '600', paddingHorizontal: space.xs },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / emojiColumns}%`, height: cellSize, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 30, lineHeight: 36 },
  skinMark: { position: 'absolute', right: 6, bottom: 6, width: 0, height: 0, borderLeftWidth: 4, borderLeftColor: 'transparent', borderBottomWidth: 4 },
  preview: { position: 'absolute', bottom: cellSize, width: 76, height: 76, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  previewGlyph: { fontSize: 64, lineHeight: 72 },
  none: { padding: space.lg, textAlign: 'center' },
  stickerRow: { flexDirection: 'row', gap: space.xs },
  gifRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingHorizontal: space.xs },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tones: { flexDirection: 'row', borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, padding: space.xs },
  tone: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
