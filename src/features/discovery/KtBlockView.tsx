import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { readBlock, type Source, type Table } from './blocks';

function Sources({ sources }: { sources: Source[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!sources.length) return null;
  return (
    <View style={styles.sources} testID="kt-block-sources">
      <Text variant="footnote" tone="inkSoft">
        {t('discovery.block.sources')}
      </Text>
      {sources.map((source, index) => (
        <View key={index} style={[styles.source, { backgroundColor: colors.surface2 }]}>
          <Text variant="label" tone="inkSoft">
            {source.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Replies({ replies, summary, onReply }: { replies: string[]; summary: string; onReply?: (text: string) => void }) {
  const { colors } = useTheme();
  const [said, setSaid] = useState<string | null>(null);
  return (
    <View style={styles.replies} accessibilityRole="none" accessibilityLabel={summary || undefined}>
      {replies.map((reply, index) => {
        const chosen = said === reply;
        const disabled = !onReply || said !== null;
        return (
          <Pressable
            key={reply}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: chosen }}
            disabled={disabled}
            onPress={() => {
              setSaid(reply);
              onReply?.(reply);
            }}
            testID={`kt-reply-${index}`}
            style={({ pressed }) => [
              styles.reply,
              {
                borderColor: chosen ? colors.primary : colors.line,
                backgroundColor: chosen ? colors.primary : pressed ? colors.surface2 : colors.surface,
                opacity: disabled && !chosen ? 0.5 : 1,
              },
            ]}>
            <Text variant="callout" style={{ color: chosen ? colors.onPrimary : colors.ink }}>
              {reply}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BlockTable({ table }: { table: Table }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.tableWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.table, { borderColor: colors.line }]} testID="kt-block-table">
          {[table.columns, ...table.rows].map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.row, rowIndex ? { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
              {row.map((cell, cellIndex) => (
                <Text
                  key={cellIndex}
                  variant={rowIndex ? 'footnote' : 'label'}
                  tone={rowIndex ? 'ink' : 'inkSoft'}
                  style={styles.cell}
                  selectable>
                  {cell ?? '-'}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {table.hidden ? (
        <Text variant="footnote" tone="inkFaint">
          {t('discovery.block.moreRows', { count: table.hidden })}
        </Text>
      ) : null}
    </View>
  );
}

export function KtBlockView({ raw, onReply }: { raw: string; onReply?: (text: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const block = readBlock(raw);
  if (block.kind === 'unreadable') {
    return (
      <Text variant="footnote" tone="inkFaint" testID="kt-block-unreadable">
        {t('discovery.block.unreadable')}
      </Text>
    );
  }
  return (
    <View style={[styles.block, { borderColor: colors.line }]} testID={`kt-block-${block.kind}`}>
      {block.title ? (
        <Text variant="headline" selectable>
          {block.title}
        </Text>
      ) : null}
      {block.summary ? <Text selectable>{block.summary}</Text> : null}
      {block.kind === 'replies' ? (
        <Replies replies={block.replies} summary={block.summary} onReply={onReply} />
      ) : block.table ? (
        <BlockTable table={block.table} />
      ) : null}
      <Sources sources={block.sources} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  replies: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  reply: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg, justifyContent: 'center' },
  sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  source: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
  tableWrap: { gap: space.xs },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
  row: { flexDirection: 'row' },
  cell: { width: 120, paddingHorizontal: space.sm, paddingVertical: space.xs },
});
