import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../../theme';
import { Sheet } from '../../../ui/Sheet';
import { Text } from '../../../ui/Text';
import type { EmojiCategory } from '../emoji/data';
import { emojiGroups, noteEmoji, recentEmoji, searchEmoji } from '../emoji/emoji';

type Tab = 'recent' | EmojiCategory;

const columns = 8;

export function EmojiPicker({ onPick, onClose, selected = [] }: { onPick: (emoji: string) => void; onClose: () => void; selected?: string[] }) {
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
    <Sheet title={t('emoji.title')} onClose={onClose} scroll={false} testID="emoji-picker">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('emoji.search')}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={t('emoji.search')}
        style={[styles.search, { backgroundColor: colors.surface2, color: colors.ink }]}
        testID="emoji-search"
      />
      {query.trim() ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => setTab(key)}
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
                style={[styles.cell, selected.includes(item) && { backgroundColor: colors.select }]}>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 44, borderRadius: radius.field, paddingHorizontal: space.md, fontSize: 16 },
  tabs: { gap: space.xs, paddingVertical: space.sm },
  tab: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  grid: { height: 300 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  emoji: { fontSize: 28, lineHeight: 34 },
  none: { textAlign: 'center', padding: space.xl },
});
