import { FlashList } from '@shopify/flash-list';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { selectedLook } from '../../../ui/pill';
import { Pressable } from '../../../ui/Pressable';
import { radius, space, stroke, useTheme } from '../../../theme';
import { Sheet } from '../../../ui/Sheet';
import { Text } from '../../../ui/Text';
import type { EmojiCategory } from '../emoji/data';
import { emojiGroups, noteEmoji, recentEmoji, searchEmoji } from '../emoji/emoji';
import { chipHeight, chipSlop, touchTarget } from '../../../ui/touch';

type Tab = 'recent' | EmojiCategory;

const columns = 8;

export function EmojiPicker({ onPick, onClose, selected = [] }: { onPick: (emoji: string) => void; onClose: () => void; selected?: string[] }) {
  const { t } = useTranslation('chat');
  return (
    <Sheet title={t('emoji.title')} onClose={onClose} scroll={false} testID="emoji-picker">
      <EmojiGrid onPick={onPick} selected={selected} style={styles.sheetGrid} />
    </Sheet>
  );
}

export function EmojiGrid({
  onPick,
  selected = [],
  style,
  trailing,
  onSearching,
}: {
  onPick: (emoji: string) => void;
  selected?: string[];
  style?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
  onSearching?: (searching: boolean) => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const groups = useMemo(() => emojiGroups(), []);
  const [recent] = useState(recentEmoji);
  const [tab, setTab] = useState<Tab>(recent.length ? 'recent' : groups[0].category);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    if (query.trim()) return searchEmoji(query);
    if (tab === 'recent') return recent;
    return groups.find((group) => group.category === tab)?.items.map((item) => item.emoji) ?? [];
  }, [groups, query, recent, tab]);
  const tabs: Tab[] = [...(recent.length ? (['recent'] as const) : []), ...groups.map((group) => group.category)];
  const pick = (emoji: string) => {
    noteEmoji(emoji);
    onPick(emoji);
  };
  return (
    <View style={[styles.body, style]}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => onSearching?.(true)}
          onBlur={() => onSearching?.(false)}
          placeholder={t('emoji.search')}
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={t('emoji.search')}
          style={[styles.search, { backgroundColor: colors.surface2, color: colors.ink }]}
          testID="emoji-search"
        />
        {trailing}
      </View>
      {query.trim() ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => setTab(key)}
              hitSlop={chipSlop}
              style={[styles.tab, { borderColor: tab === key ? colors.focus : colors.line, backgroundColor: tab === key ? colors.select : 'transparent' }]}
              testID={`emoji-tab-${key}`}>
              <Text variant="footnote" tone={tab === key ? 'selectInk' : 'inkSoft'}>
                {t(`emoji.category.${key}`)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.grid}>
        {shown.length ? (
          <FlashList
            data={shown}
            numColumns={columns}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <Pressable
                testID={`emoji-cell-${index}`}
                accessibilityRole="button"
                accessibilityLabel={item}
                accessibilityState={{ selected: selected.includes(item) }}
                onPress={() => pick(item)}
                style={[styles.cell, selected.includes(item) && selectedLook(colors)]}>
                <Text style={styles.emoji}>{item}</Text>
              </Pressable>
            )}
          />
        ) : (
          <Text variant="callout" tone="inkSoft" style={styles.none}>
            {t('emoji.none')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xs },
  sheetGrid: { height: 420 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  search: { flex: 1, minHeight: 44, borderRadius: radius.pill, paddingHorizontal: space.md, fontSize: 16 },
  tabs: { gap: space.xs, paddingVertical: space.sm },
  tab: { minHeight: chipHeight, minWidth: touchTarget, alignItems: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: stroke.thin, justifyContent: 'center' },
  grid: { flex: 1, minHeight: 120 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  emoji: { fontSize: 28, lineHeight: 34 },
  none: { textAlign: 'center', padding: space.xl },
});
