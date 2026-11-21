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
const COLUMN_FIT = Math.floor((MAX_COLUMN - space.md * 2) / CHAR_WIDTH) - 2;
const BULLET = '\u2022';
const MARKER_GAP = '\u2002';
const INDENT = '\u2003\u2003';

type Paint = { color: string; tint: string; selectable: boolean; colors: Colors };
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

export function isFlatList(block: ListBlock): boolean {
  return block.items.every((item) => item.sub.every((sub) => sub.kind === 'list' && isFlatList(sub)));
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

function columnWidths(rows: Span[][][]): number[] {
  return rows[0].map((_cell, column) => {
    const longest = Math.max(...rows.map((row) => plain(row[column] ?? []).length));
    return Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, longest * CHAR_WIDTH + space.md * 2));
  });
}

export function fitsColumns(rows: Span[][][]): boolean {
  return rows.every((row) =>
    row.every((cell) => {
      const text = plain(cell);
      return text.length <= COLUMN_FIT && !text.includes('\n');
    }),
  );
}

function Table({ block, paint }: { block: TableBlock; paint: Paint }) {
  const { t } = useTranslation('chat');
  const { colors, color, tint } = paint;
  const all = block.head ? [block.head, ...block.rows] : block.rows;
  if (!all.length) return null;
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
  const body = fitsColumns(block.rows) ? (
    block.rows.length ? (
      <View style={[styles.row, block.head && [styles.divider, { borderColor: colors.line }]]}>
        {widths.map((_width, column) => (
          <NativeText key={column} style={[cellStyle(column, false), styles.column]}>
            {block.rows.flatMap((cells, index) => [index ? '\n' : '', ...spanNodes(cells[column] ?? [], paint, `r${index}.${column}`)])}
          </NativeText>
        ))}
      </View>
    ) : null
  ) : (
    block.rows.map((cells, index) => row(cells, false, index, index > 0 || !!block.head))
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
        {body}
      </View>
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
  column: { lineHeight: 28, paddingVertical: 0 },
  lastCell: { borderRightWidth: 0 },
});
