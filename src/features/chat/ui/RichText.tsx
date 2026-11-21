import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, Text as NativeText, View, type TextStyle } from 'react-native';
import { radius, space, type as typography, useTheme, type Colors } from '../../../theme';
import type { Span } from '../html';
import type { MdBlock } from '../markdown';

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
const CHAR_WIDTH = 9;
const MIN_COLUMN = 72;
const MAX_COLUMN = 240;
const BULLET = '\u2022';

type Paint = { color: string; tint: string; selectable: boolean; colors: Colors };

function open(href: string) {
  void Linking.openURL(href);
}

function spanStyle(span: Span, colors: Colors, tint: string): TextStyle[] {
  const style: TextStyle[] = [];
  if (span.bold) style.push(styles.bold);
  if (span.italic) style.push(styles.italic);
  if (span.code) style.push(styles.code, { backgroundColor: tint });
  if (span.mention) style.push(styles.mention, { color: colors.link, backgroundColor: colors.select });
  if (span.href) style.push({ color: colors.link });
  const lines = [span.href && 'underline', span.strike && 'line-through'].filter(Boolean).join(' ');
  if (lines) style.push({ textDecorationLine: lines as TextStyle['textDecorationLine'] });
  return style;
}

function Spans({ spans, paint }: { spans: Span[]; paint: Paint }) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold || span.italic || span.strike || span.code || span.href || span.mention ? (
          <NativeText
            key={index}
            style={spanStyle(span, paint.colors, paint.tint)}
            onPress={span.href ? () => open(span.href as string) : undefined}
            accessibilityRole={span.href ? 'link' : undefined}>
            {span.text}
          </NativeText>
        ) : (
          span.text
        ),
      )}
    </>
  );
}

function Line({ spans, paint, style }: { spans: Span[]; paint: Paint; style?: TextStyle }) {
  return (
    <NativeText selectable={paint.selectable} style={[typography.body, { color: paint.color }, style]}>
      <Spans spans={spans} paint={paint} />
    </NativeText>
  );
}

function plain(spans: Span[]): string {
  return spans.map((span) => span.text).join('');
}

function columnWidths(rows: Span[][][]): number[] {
  return rows[0].map((_cell, column) => {
    const longest = Math.max(...rows.map((row) => plain(row[column] ?? []).length));
    return Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, longest * CHAR_WIDTH + space.md * 2));
  });
}

function Table({ block, paint }: { block: Extract<MdBlock, { kind: 'table' }>; paint: Paint }) {
  const { t } = useTranslation('chat');
  const { colors, color, tint } = paint;
  const all = block.head ? [block.head, ...block.rows] : block.rows;
  if (!all.length) return null;
  const widths = columnWidths(all);
  const row = (cells: Span[][], header: boolean, key: number, divided: boolean) => (
    <View key={key} style={[styles.row, header && { backgroundColor: tint }, divided && [styles.divider, { borderColor: colors.line }]]}>
      {cells.map((cell, column) => (
        <NativeText
          key={column}
          style={[
            styles.cell,
            { width: widths[column], borderColor: colors.line, color, textAlign: block.align[column] },
            column === cells.length - 1 && styles.lastCell,
            header && styles.bold,
          ]}>
          <Spans spans={cell} paint={paint} />
        </NativeText>
      ))}
    </View>
  );
  return (
    <ScrollView
      horizontal
      style={styles.scroller}
      contentContainerStyle={styles.scrolled}
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      accessibilityLabel={t('thread.table', { columns: widths.length, rows: block.rows.length })}
      testID="markdown-table">
      <View style={[styles.table, { borderColor: colors.line }]}>
        {block.head ? row(block.head, true, -1, false) : null}
        {block.rows.map((cells, index) => row(cells, false, index, index > 0 || !!block.head))}
      </View>
    </ScrollView>
  );
}

function List({ block, paint }: { block: Extract<MdBlock, { kind: 'list' }>; paint: Paint }) {
  return (
    <View style={styles.list}>
      {block.items.map((item, position) => (
        <View key={position} style={styles.item}>
          <NativeText style={[typography.body, styles.marker, { color: paint.colors.inkSoft }]}>{block.ordered ? `${block.start + position}.` : BULLET}</NativeText>
          <View style={styles.fill}>
            {item.spans.length ? <Line spans={item.spans} paint={paint} /> : null}
            {item.sub.length ? <Blocks blocks={item.sub} paint={paint} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function Blocks({ blocks, paint }: { blocks: MdBlock[]; paint: Paint }) {
  return (
    <>
      {blocks.map((block, index): ReactNode => {
        if (block.kind === 'text') return <Line key={index} spans={block.spans} paint={paint} />;
        if (block.kind === 'list') return <List key={index} block={block} paint={paint} />;
        if (block.kind === 'quote') {
          return (
            <View key={index} style={[styles.quote, { backgroundColor: paint.tint }]}>
              <Blocks blocks={block.blocks} paint={{ ...paint, tint: paint.colors.surface }} />
            </View>
          );
        }
        if (block.kind === 'code') {
          return (
            <View key={index} style={[styles.codeBlock, { backgroundColor: paint.tint }]}>
              <NativeText selectable={paint.selectable} style={[styles.codeText, { color: paint.color }]}>
                {block.text}
              </NativeText>
            </View>
          );
        }
        if (block.kind === 'rule') return <View key={index} style={[styles.rule, { backgroundColor: paint.colors.line }]} />;
        return <Table key={index} block={block} paint={paint} />;
      })}
    </>
  );
}

export const RichText = memo(function RichText({
  blocks,
  color,
  tint,
  selectable = false,
}: {
  blocks: MdBlock[];
  color?: string;
  tint?: string;
  selectable?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Blocks blocks={blocks} paint={{ color: color ?? colors.ink, tint: tint ?? colors.surface2, selectable, colors }} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: mono, fontSize: 15 },
  mention: { fontWeight: '600', borderRadius: 4 },
  list: { gap: 2 },
  item: { flexDirection: 'row', gap: space.sm },
  marker: { minWidth: 14, fontVariant: ['tabular-nums'] },
  fill: { flex: 1, flexShrink: 1, gap: 2 },
  quote: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs, gap: space.xs },
  codeBlock: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  codeText: { fontFamily: mono, fontSize: 14, lineHeight: 20 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: space.xs },
  scroller: { flexGrow: 0, flexShrink: 0 },
  scrolled: { alignItems: 'flex-start' },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  cell: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRightWidth: StyleSheet.hairlineWidth, fontSize: 15, lineHeight: 20 },
  lastCell: { borderRightWidth: 0 },
});
