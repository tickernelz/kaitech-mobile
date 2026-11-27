import { memo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, PixelRatio, Platform, ScrollView, StyleSheet, Text as NativeText, View, type TextLayoutEvent, type TextStyle } from 'react-native';
import { radius, space, type as typography, useTheme, type Colors } from '../../../theme';
import { Pressable } from '../../../ui/Pressable';
import type { Span } from '../html';
import { isFlatList, type MdBlock } from '../markdown';

const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
const CHAR_WIDTH = 9;
const CAPITAL_WIDTH = 11;
const MIN_COLUMN = 72;
const MAX_COLUMN = 240;
const COLUMN_LINE = 30;
const BULLET = '\u2022';
const MARKER_GAP = '\u2002';
const INDENT = '\u2003\u2003';

type Paint = { color: string; tint: string; selectable: boolean; colors: Colors; onLongPress?: () => void };

export const LONG_PRESS_MS = 300;
type ListBlock = Extract<MdBlock, { kind: 'list' }>;
type TableBlock = Extract<MdBlock, { kind: 'table' }>;

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

function spanNodes(spans: Span[], paint: Paint, key: string): ReactNode[] {
  return spans.map((span, index) =>
    span.bold || span.italic || span.strike || span.code || span.href || span.mention ? (
      <NativeText
        key={`${key}.${index}`}
        style={spanStyle(span, paint.colors, paint.tint)}
        onPress={span.href ? () => open(span.href as string) : undefined}
        accessibilityRole={span.href ? 'link' : undefined}>
        {span.text}
      </NativeText>
    ) : (
      span.text
    ),
  );
}

function flows(block: MdBlock): boolean {
  return block.kind === 'text' || (block.kind === 'list' && isFlatList(block));
}

function listNodes(block: ListBlock, depth: number, paint: Paint, key: string, out: ReactNode[]) {
  block.items.forEach((item, position) => {
    if (out.length) out.push('\n');
    const marker = block.ordered ? `${block.start + position}.` : BULLET;
    out.push(
      <NativeText key={`${key}.m${position}`} style={{ color: paint.colors.inkSoft }}>
        {INDENT.repeat(depth) + marker + MARKER_GAP}
      </NativeText>,
    );
    out.push(...spanNodes(item.spans, paint, `${key}.${position}`));
    item.sub.forEach((sub, index) => listNodes(sub as ListBlock, depth + 1, paint, `${key}.${position}.${index}`, out));
  });
}

function Flow({ blocks, paint }: { blocks: MdBlock[]; paint: Paint }) {
  const children: ReactNode[] = [];
  blocks.forEach((block, index) => {
    if (index) children.push('\n', <NativeText key={`gap${index}`} style={styles.gap}>{'\n'}</NativeText>);
    if (block.kind === 'text') children.push(...spanNodes(block.spans, paint, `b${index}`));
    else if (block.kind === 'list') {
      const lines: ReactNode[] = [];
      listNodes(block, 0, paint, `b${index}`, lines);
      children.push(...lines);
    }
  });
  return (
    <NativeText selectable={paint.selectable} style={[typography.body, { color: paint.color }]}>
      {children}
    </NativeText>
  );
}

function plain(spans: Span[]): string {
  return spans.map((span) => span.text).join('');
}

export function textWidth(text: string, scale = PixelRatio.getFontScale()): number {
  let width = 0;
  for (const char of text) width += /[A-Z@#%&mw]/.test(char) ? CAPITAL_WIDTH : CHAR_WIDTH;
  return width * scale;
}

function columnWidths(rows: Span[][][]): number[] {
  return rows[0].map((_cell, column) => {
    const widest = Math.max(...rows.map((row) => textWidth(plain(row[column] ?? []))));
    return Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, Math.ceil(widest + space.md * 2)));
  });
}

export function fitsColumns(rows: Span[][][]): boolean {
  return rows.every((row) =>
    row.every((cell) => {
      const text = plain(cell);
      return textWidth(text) <= MAX_COLUMN - space.md * 2 && !text.includes('\n');
    }),
  );
}

function Table({ block, paint }: { block: TableBlock; paint: Paint }) {
  const { t } = useTranslation('chat');
  const { colors, color, tint } = paint;
  const [wrapped, setWrapped] = useState<TableBlock | null>(null);
  const all = block.head ? [block.head, ...block.rows] : block.rows;
  if (!all.length) return null;
  const lines = all.length;
  const measure = (event: TextLayoutEvent) => {
    if (event.nativeEvent.lines.length !== lines) setWrapped(block);
  };
  const widths = columnWidths(all);
  const cellStyle = (column: number, header: boolean) => [
    styles.cell,
    { width: widths[column], borderColor: colors.line, color, textAlign: block.align[column] },
    column === widths.length - 1 && styles.lastCell,
    header && styles.bold,
  ];
  const row = (cells: Span[][], header: boolean, key: number, divided: boolean) => (
    <View key={key} style={[styles.row, header && { backgroundColor: tint }, divided && [styles.divider, { borderColor: colors.line }]]}>
      {cells.map((cell, column) => (
        <NativeText key={column} style={cellStyle(column, header)}>
          {spanNodes(cell, paint, `c${key}.${column}`)}
        </NativeText>
      ))}
    </View>
  );
  const columns = wrapped !== block && fitsColumns(all) ? (
    <View style={styles.row}>
      {block.head ? <View style={[styles.headBand, { backgroundColor: tint, borderColor: colors.line }]} /> : null}
      {widths.map((_width, column) => (
        <NativeText key={column} style={[cellStyle(column, false), styles.column]} onTextLayout={measure}>
          {block.head ? <NativeText style={styles.bold}>{spanNodes(block.head[column] ?? [], paint, `h${column}`)}</NativeText> : null}
          {block.rows.flatMap((cells, index) => [index || block.head ? '\n' : '', ...spanNodes(cells[column] ?? [], paint, `r${index}.${column}`)])}
        </NativeText>
      ))}
    </View>
  ) : null;
  const cells = columns ?? (
    <>
      {block.head ? row(block.head, true, -1, false) : null}
      {block.rows.map((cells, index) => row(cells, false, index, index > 0 || !!block.head))}
    </>
  );
  const frame = [styles.table, { borderColor: colors.line }];
  return (
    <ScrollView
      horizontal
      style={styles.scroller}
      contentContainerStyle={styles.scrolled}
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      accessibilityLabel={t('thread.table', { columns: widths.length, rows: block.rows.length })}
      testID="markdown-table">
      {paint.onLongPress ? (
        <Pressable onLongPress={paint.onLongPress} delayLongPress={LONG_PRESS_MS} accessible={false} style={frame} testID="markdown-table-content">
          {cells}
        </Pressable>
      ) : (
        <View style={frame} testID="markdown-table-content">
          {cells}
        </View>
      )}
    </ScrollView>
  );
}

function ListItems({ block, paint }: { block: ListBlock; paint: Paint }) {
  return (
    <View style={styles.list}>
      {block.items.map((item, position) => (
        <View key={position} style={styles.item}>
          <NativeText selectable={paint.selectable} style={[typography.body, { color: paint.color }]}>
            <NativeText style={{ color: paint.colors.inkSoft }}>{(block.ordered ? `${block.start + position}.` : BULLET) + MARKER_GAP}</NativeText>
            {spanNodes(item.spans, paint, `i${position}`)}
          </NativeText>
          {item.sub.length ? (
            <View style={styles.sub}>
              <Blocks blocks={item.sub} paint={paint} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Blocks({ blocks, paint }: { blocks: MdBlock[]; paint: Paint }) {
  const out: ReactNode[] = [];
  let run: MdBlock[] = [];
  const close = () => {
    if (run.length) out.push(<Flow key={`f${out.length}`} blocks={run} paint={paint} />);
    run = [];
  };
  blocks.forEach((block, index) => {
    if (flows(block)) {
      run.push(block);
      return;
    }
    close();
    if (block.kind === 'list') out.push(<ListItems key={index} block={block} paint={paint} />);
    else if (block.kind === 'quote') {
      out.push(
        <View key={index} style={[styles.quote, { backgroundColor: paint.tint }]}>
          <Blocks blocks={block.blocks} paint={{ ...paint, tint: paint.colors.surface }} />
        </View>,
      );
    } else if (block.kind === 'code') {
      out.push(
        <View key={index} style={[styles.codeBlock, { backgroundColor: paint.tint }]}>
          <NativeText selectable={paint.selectable} style={[styles.codeText, { color: paint.color }]}>
            {block.text}
          </NativeText>
        </View>,
      );
    } else if (block.kind === 'rule') out.push(<View key={index} style={[styles.rule, { backgroundColor: paint.colors.line }]} />);
    else if (block.kind === 'table') out.push(<Table key={index} block={block} paint={paint} />);
  });
  close();
  return <>{out}</>;
}

export const RichText = memo(function RichText({
  blocks,
  color,
  tint,
  selectable = false,
  onLongPress,
}: {
  blocks: MdBlock[];
  color?: string;
  tint?: string;
  selectable?: boolean;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Blocks blocks={blocks} paint={{ color: color ?? colors.ink, tint: tint ?? colors.surface2, selectable, colors, onLongPress }} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: mono, fontSize: 15 },
  mention: { fontWeight: '600', borderRadius: 4 },
  gap: { fontSize: 4, lineHeight: 6 },
  list: { gap: 2 },
  item: { gap: 2 },
  sub: { paddingLeft: space.lg },
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
  column: { lineHeight: COLUMN_LINE, paddingVertical: 0 },
  headBand: { position: 'absolute', top: 0, left: 0, right: 0, height: COLUMN_LINE, borderBottomWidth: StyleSheet.hairlineWidth },
  lastCell: { borderRightWidth: 0 },
});
