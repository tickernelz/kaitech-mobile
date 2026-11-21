import * as Clipboard from 'expo-clipboard';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { rpc } from '../../../api/odoo';
import { randomUUID } from 'expo-crypto';
import { radius, space, useTheme } from '../../../theme';
import { Icon } from '../../../ui/icons';
import { Text } from '../../../ui/Text';
import { sparkShape, sparkText } from './chartShape';
import { decimalsOf, useNumbers, type Numbers } from './format';
import { useThread, type Place } from './place';
import { isDate, isNumber, SUMMED, type Cell, type Column, type TableBlock, type Tone } from './read';
import { BlockTitle, seriesColor, Status, Tool, styles as shared } from './ui';

const FIRST_ROWS = 20;
const TONE_OF_WORD = new Map<string, Tone>(
  Object.entries({
    good: ['done', 'ok', 'on track', 'approved', 'accepted', 'complete', 'completed', 'paid', 'under', 'met', 'selesai', 'disetujui', 'diterima', 'lunas', 'aman', 'sesuai', 'tercapai'],
    warn: ['at risk', 'watch', 'pending', 'waiting', 'in review', 'review', 'draft', 'partial', 'menunggu', 'tertunda', 'sebagian', 'berisiko', 'ditinjau'],
    bad: ['over', 'late', 'blocked', 'overdue', 'rejected', 'failed', 'missing', 'terlambat', 'ditolak', 'gagal', 'macet', 'melebihi', 'hilang'],
    info: ['forecast', 'planned', 'open', 'new', 'in progress', 'berjalan', 'rencana', 'baru', 'terbuka', 'proyeksi'],
  }).flatMap(([tone, words]) => words.map((word) => [word, tone as Tone])),
);

type Row = { cells: Cell[]; position: number };
type Shaped = Column & { position: number; places: number };

export function statusTone(column: Column, value: Cell): Tone {
  if (value === null || value === undefined) return 'neutral';
  const named = column.tones?.[String(value)];
  if (named) return named;
  return TONE_OF_WORD.get(String(value).trim().toLowerCase()) ?? 'neutral';
}

function placesOf(column: Column, position: number, rows: Cell[][]): number {
  if (column.decimals !== null) return column.decimals;
  return decimalsOf(rows.flatMap((row) => ([] as unknown[]).concat(row[position]))) ? 2 : 0;
}

function compared(left: Cell, right: Cell, kind: Column['kind']): number {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  if (SUMMED.includes(kind)) return (left as number) - (right as number);
  if (kind === 'spark') return lastOf(left as (number | null)[]) - lastOf(right as (number | null)[]);
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

function lastOf(values: (number | null)[]): number {
  const known = values.filter(isNumber);
  return known.length ? known[known.length - 1] : -Infinity;
}

export function cellText(numbers: Numbers, column: Shaped, value: Cell): string {
  if (value === null || value === undefined) return '';
  if (SUMMED.includes(column.kind) && typeof value === 'number') return numbers.number(value, column.places);
  if (column.kind === 'date' && isDate(value)) return numbers.date(value);
  if (column.kind === 'spark' && Array.isArray(value)) return sparkText(numbers, value, column.places);
  return String(value);
}

function markdownCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
}

export function tableMarkdown(numbers: Numbers, columns: Shaped[], rows: Row[], total: (number | null)[] | null, totalWord: string): string {
  const heading = (column: Shaped) => (column.unit ? column.name + ' (' + column.unit + ')' : column.name);
  const lines = [
    '| ' + columns.map((column) => markdownCell(heading(column))).join(' | ') + ' |',
    '| ' + columns.map((column) => (SUMMED.includes(column.kind) ? '---:' : '---')).join(' | ') + ' |',
  ];
  for (const row of rows) lines.push('| ' + columns.map((column) => markdownCell(cellText(numbers, column, row.cells[column.position]))).join(' | ') + ' |');
  if (total) {
    const cells = columns.map((column) => (column.total ? cellText(numbers, column, total[column.position]) : column.position === 0 ? totalWord : ''));
    lines.push('| ' + cells.map((cell) => (cell ? '**' + markdownCell(cell) + '**' : '')).join(' | ') + ' |');
  }
  return lines.join('\n');
}

export function shapeColumns(block: TableBlock): Shaped[] {
  return block.columns.map((column, position) => ({ ...column, total: column.total && SUMMED.includes(column.kind), position, places: placesOf(column, position, block.rows) }));
}

function widthOf(column: Shaped, numbers: Numbers, rows: Cell[][]): number {
  const sample = rows.slice(0, 40).map((row) => cellText(numbers, column, row[column.position]).length);
  const longest = Math.max(column.name.length + (column.unit ? column.unit.length + 2 : 0), ...sample);
  if (column.kind === 'spark') return 132;
  if (column.kind === 'status') return Math.min(200, Math.max(96, longest * 7.5 + 40));
  return Math.min(220, Math.max(64, longest * 7.5 + 24));
}

function Spark({ values, said }: { values: (number | null)[]; said: string }) {
  const { scheme } = useTheme();
  const shape = sparkShape(values, 64, 20);
  return (
    <View style={styles.spark}>
      <Svg width={64} height={20} accessible={false}>
        <Path d={shape.d} stroke={seriesColor(0, scheme)} strokeWidth={1.5} fill="none" />
        {shape.end ? <Circle cx={shape.end.x} cy={shape.end.y} r={2.5} fill={seriesColor(0, scheme)} /> : null}
      </Svg>
      <Text variant="label" tone="inkSoft">
        {said}
      </Text>
    </View>
  );
}

async function exportAs(account: NonNullable<ReturnType<typeof useThread>['account']>, place: Place, fileFormat: 'csv' | 'xlsx', order: number[] | null) {
  const file = await rpc<{ name: string; mimetype: string; data: string }>(account, 'ck.turn', 'export_block', [[place.turnId], place.seq, place.index, fileFormat, order]);
  const folder = new Directory(Paths.cache, 'kt-export', randomUUID());
  folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, file.name.replace(/[\\/:*?"<>|]+/g, '_') || 'export.' + fileFormat);
  target.write(file.data, { encoding: 'base64' });
  try {
    await Sharing.shareAsync(target.uri, { mimeType: file.mimetype, dialogTitle: file.name });
  } finally {
    folder.delete();
  }
}

export const KtTable = memo(function KtTable({ block, place, exportable = true, ordered = true }: { block: TableBlock; place: Place | null; exportable?: boolean; ordered?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const numbers = useNumbers();
  const thread = useThread();
  const [sortBy, setSortBy] = useState(-1);
  const [descending, setDescending] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [everyRow, setEveryRow] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [busy, setBusy] = useState(false);
  const columns = useMemo(() => shapeColumns(block), [block]);
  const widths = useMemo(() => columns.map((column) => widthOf(column, numbers, block.rows)), [columns, numbers, block.rows]);
  const rows = useMemo<Row[]>(() => block.rows.map((cells, position) => ({ cells, position })), [block.rows]);
  const statusColumn = columns.find((column) => column.kind === 'status') ?? null;
  const statuses = useMemo(() => (statusColumn ? [...new Set(rows.map((row) => String(row.cells[statusColumn.position] ?? '')))] : []), [rows, statusColumn]);
  const visible = useMemo(() => {
    const hiddenSet = new Set(hidden);
    let shown = statusColumn ? rows.filter((row) => !hiddenSet.has(String(row.cells[statusColumn.position] ?? ''))) : rows.slice();
    if (sortBy >= 0) {
      const column = columns[sortBy];
      const direction = descending ? -1 : 1;
      shown = shown.sort((left, right) => {
        const leftCell = left.cells[column.position];
        const rightCell = right.cells[column.position];
        if (leftCell === null || rightCell === null) return compared(leftCell, rightCell, column.kind);
        return direction * compared(leftCell, rightCell, column.kind) || left.position - right.position;
      });
    }
    return shown;
  }, [rows, hidden, statusColumn, sortBy, descending, columns]);
  const shownRows = everyRow ? visible : visible.slice(0, FIRST_ROWS);
  const totalRow = rows.length && columns.some((column) => column.total) ? columns.map((column) => (column.total ? visible.reduce((sum, row) => sum + ((row.cells[column.position] as number | null) ?? 0), 0) : null)) : null;
  const listed = rows.length;
  const countLabel =
    block.rowCount !== null && block.rowCount > listed
      ? t('discovery.block.table.listedOf', { listed, count: block.rowCount })
      : visible.length !== listed
        ? t('discovery.block.table.shownOf', { shown: visible.length, listed })
        : t('discovery.block.table.rows', { count: listed });
  const canExport = exportable && !!thread.account && !!place && place.turnId !== null && place.seq !== null;
  const sort = (column: Shaped) => {
    if (sortBy === column.position) setDescending(!descending);
    else {
      setSortBy(column.position);
      setDescending(SUMMED.includes(column.kind));
    }
  };
  const copy = async () => {
    await Clipboard.setStringAsync(tableMarkdown(numbers, columns, visible, totalRow, t('discovery.block.table.total')));
    Alert.alert('', t('discovery.block.table.copied'));
  };
  const runExport = (fileFormat: 'csv' | 'xlsx') => {
    if (!thread.account || !place || busy) return;
    setBusy(true);
    exportAs(thread.account, place, fileFormat, ordered ? visible.map((row) => row.position) : null)
      .catch(() => Alert.alert('', t('discovery.block.table.exportFailed')))
      .finally(() => setBusy(false));
  };
  return (
    <View style={shared.gap} testID="kt-table">
      <BlockTitle title={block.title} count={countLabel} />
      {rows.length ? (
        <View style={shared.tools}>
          {statusColumn ? <Tool icon="filter" label={t('discovery.block.table.filter')} on={filtering || hidden.length > 0} onPress={() => setFiltering(!filtering)} testID="kt-table-filter" /> : null}
          <Tool icon="copy" label={t('discovery.block.table.copyMarkdown')} onPress={() => void copy()} testID="kt-table-copy" />
          {canExport ? <Tool icon="download" label={t('discovery.block.table.csv')} disabled={busy} onPress={() => runExport('csv')} testID="kt-table-csv" /> : null}
          {canExport ? <Tool icon="download" label={t('discovery.block.table.xlsx')} disabled={busy} onPress={() => runExport('xlsx')} testID="kt-table-xlsx" /> : null}
        </View>
      ) : null}
      {filtering && statusColumn ? (
        <View style={shared.tools} accessibilityLabel={statusColumn.name}>
          {statuses.map((value) => {
            const on = !hidden.includes(value);
            return (
              <Pressable
                key={value}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setHidden(on ? [...hidden, value] : hidden.filter((one) => one !== value))}
                style={[styles.chip, { borderColor: on ? colors.primary : colors.line, opacity: on ? 1 : 0.55 }]}>
                <Status tone={statusTone(statusColumn, value || null)} text={value || t('discovery.block.table.noStatus')} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={[styles.grid, { borderColor: colors.line }]}>
          <View style={[styles.row, { backgroundColor: colors.surface2 }]}>
            {columns.map((column) => {
              const summed = SUMMED.includes(column.kind);
              const active = sortBy === column.position;
              return (
                <Pressable
                  key={column.position}
                  accessibilityRole="button"
                  accessibilityLabel={t('discovery.block.table.sortBy', { name: column.name })}
                  accessibilityState={{ selected: active }}
                  onPress={() => sort(column)}
                  style={[styles.head, { width: widths[column.position] }, summed ? styles.end : null]}>
                  <Text variant="label" tone="inkSoft" numberOfLines={2} style={summed ? styles.right : null}>
                    {column.unit ? column.name + ' (' + column.unit + ')' : column.name}
                  </Text>
                  {active ? <Icon name={descending ? 'arrowDown' : 'arrowUp'} size={12} color={colors.inkSoft} /> : null}
                </Pressable>
              );
            })}
          </View>
          {shownRows.map((row) => (
            <View key={row.position} style={[styles.row, { borderTopColor: colors.line }, styles.divided]}>
              {columns.map((column) => {
                const value = row.cells[column.position];
                const width = { width: widths[column.position] };
                if (column.kind === 'status' && value !== null) {
                  return (
                    <View key={column.position} style={[styles.cell, width]}>
                      <Status tone={statusTone(column, value)} text={String(value)} />
                    </View>
                  );
                }
                if (column.kind === 'spark' && Array.isArray(value)) {
                  return (
                    <View key={column.position} style={[styles.cell, width]}>
                      <Spark values={value} said={cellText(numbers, column, value)} />
                    </View>
                  );
                }
                return (
                  <Text key={column.position} variant="footnote" selectable style={[styles.textCell, width, SUMMED.includes(column.kind) ? styles.right : null]}>
                    {cellText(numbers, column, value)}
                  </Text>
                );
              })}
            </View>
          ))}
          {!shownRows.length ? (
            <View style={[styles.cell, styles.divided, { borderTopColor: colors.line }]}>
              <Text variant="footnote" tone="inkSoft">
                {rows.length ? t('discovery.block.table.noMatch') : t('discovery.block.table.empty')}
              </Text>
            </View>
          ) : null}
          {totalRow ? (
            <View style={[styles.row, styles.divided, { borderTopColor: colors.lineStrong, backgroundColor: colors.surface2 }]}>
              {columns.map((column) => (
                <View key={column.position} style={[styles.cell, { width: widths[column.position] }, SUMMED.includes(column.kind) ? styles.end : null]}>
                  <Text variant="footnote" style={[styles.bold, SUMMED.includes(column.kind) ? styles.right : null]}>
                    {column.total ? cellText(numbers, column, totalRow[column.position]) : column.position === 0 ? t('discovery.block.table.total') : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      {visible.length > shownRows.length ? (
        <View style={styles.more}>
          <Text variant="footnote" tone="inkSoft" style={shared.grow}>
            {t('discovery.block.table.page', { shown: shownRows.length, all: visible.length })}
          </Text>
          <Tool icon="chevronDown" label={t('discovery.block.table.showAll')} onPress={() => setEveryRow(true)} testID="kt-table-all" />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.sm, paddingVertical: space.sm, minHeight: 40 },
  cell: { paddingHorizontal: space.sm, paddingVertical: space.sm, justifyContent: 'center' },
  textCell: { paddingHorizontal: space.sm, paddingVertical: space.sm, alignSelf: 'center' },
  end: { justifyContent: 'flex-end', alignItems: 'flex-end' },
  right: { textAlign: 'right' },
  bold: { fontWeight: '700' },
  spark: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  chip: { borderWidth: 1, borderRadius: radius.pill, padding: 2 },
  more: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
