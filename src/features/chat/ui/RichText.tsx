import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, Text as NativeText, View, type TextStyle } from 'react-native';
import { radius, space, type as typography, useTheme, type Colors } from '../../../theme';
import type { Span } from '../html';
import type { MdBlock } from '../markdown';

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
const CHAR_WIDTH = 8;
const MIN_COLUMN = 72;
const MAX_COLUMN = 240;
const BULLETS = ['\u2022', '\u25e6'];

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

function Spans({ spans, colors, tint }: { spans: Span[]; colors: Colors; tint: string }) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold || span.italic || span.strike || span.code || span.href || span.mention ? (
          <NativeText
            key={index}
            style={spanStyle(span, colors, tint)}
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

function plain(spans: Span[]): string {
  return spans.map((span) => span.text).join('');
}

function columnWidths(head: Span[][], rows: Span[][][]): number[] {
  return head.map((cell, column) => {
    const longest = Math.max(plain(cell).length, ...rows.map((row) => plain(row[column]).length));
    return Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, longest * CHAR_WIDTH + space.md * 2));
  });
}

function Table({ block, color, colors, tint }: { block: Extract<MdBlock, { kind: 'table' }>; color: string; colors: Colors; tint: string }) {
  const { t } = useTranslation('chat');
  const widths = columnWidths(block.head, block.rows);
  const row = (cells: Span[][], header: boolean, key: number) => (
    <View key={key} style={[styles.row, header ? { backgroundColor: tint } : [styles.divider, { borderColor: colors.line }]]}>
      {cells.map((cell, column) => (
        <NativeText
          key={column}
          style={[
            styles.cell,
            { width: widths[column], borderColor: colors.line, color, textAlign: block.align[column] },
            column === cells.length - 1 && styles.lastCell,
            header && styles.bold,
          ]}>
          <Spans spans={cell} colors={colors} tint={tint} />
        </NativeText>
      ))}
    </View>
  );
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      accessibilityLabel={t('thread.table', { columns: block.head.length, rows: block.rows.length })}
      testID="markdown-table">
      <View style={[styles.table, { borderColor: colors.line }]}>
        {row(block.head, true, -1)}
        {block.rows.map((cells, index) => row(cells, false, index))}
      </View>
    </ScrollView>
  );
}

function Blocks({ blocks, color, tint, selectable, colors }: { blocks: MdBlock[]; color: string; tint: string; selectable: boolean; colors: Colors }) {
  return (
    <>
      {blocks.map((block, index): ReactNode => {
        if (block.kind === 'text') {
          return (
            <NativeText key={index} selectable={selectable} style={[typography.body, { color }, block.heading && styles.bold]}>
              <Spans spans={block.spans} colors={colors} tint={tint} />
            </NativeText>
          );
        }
        if (block.kind === 'list') {
          return (
            <View key={index} style={styles.list}>
              {block.items.map((item, position) => (
                <View key={position} style={[styles.item, { paddingLeft: item.depth * space.lg }]}>
                  <NativeText style={[typography.body, styles.marker, { color: colors.inkSoft }]}>{item.marker || BULLETS[item.depth ? 1 : 0]}</NativeText>
                  <NativeText selectable={selectable} style={[typography.body, styles.fill, { color }]}>
                    <Spans spans={item.spans} colors={colors} tint={tint} />
                  </NativeText>
                </View>
              ))}
            </View>
          );
        }
        if (block.kind === 'quote') {
          return (
            <View key={index} style={[styles.quote, { backgroundColor: tint }]}>
              <Blocks blocks={block.blocks} color={color} tint={colors.surface} selectable={selectable} colors={colors} />
            </View>
          );
        }
        if (block.kind === 'code') {
          return (
            <View key={index} style={[styles.codeBlock, { backgroundColor: tint }]}>
              <NativeText selectable={selectable} style={[styles.codeText, { color }]}>
                {block.text}
              </NativeText>
            </View>
          );
        }
        return <Table key={index} block={block} color={color} colors={colors} tint={tint} />;
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
      <Blocks blocks={blocks} color={color ?? colors.ink} tint={tint ?? colors.surface2} selectable={selectable} colors={colors} />
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
  fill: { flex: 1, flexShrink: 1 },
  quote: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs, gap: space.xs },
  codeBlock: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  codeText: { fontFamily: mono, fontSize: 14, lineHeight: 20 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  cell: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRightWidth: StyleSheet.hairlineWidth, fontSize: 15, lineHeight: 20 },
  lastCell: { borderRightWidth: 0 },
});
