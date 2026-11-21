export type Obj = Record<string, unknown>;
export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';
export type Better = 'up' | 'down' | null;
export type Source = { label: string; ref: string };
export type Frame = { type: string; title: string; summary: string; sources: Source[] };

export type ColumnKind = 'text' | 'number' | 'money' | 'date' | 'status' | 'spark';
export type Column = { name: string; kind: ColumnKind; unit: string; decimals: number | null; total: boolean; tones: Record<string, Tone> | null };
export type Cell = string | number | (number | null)[] | null;
export type TableBlock = { title: string; columns: Column[]; rows: Cell[][]; rowCount: number | null };

export type ChartKind = 'bar' | 'stacked_bar' | 'line' | 'area' | 'stacked_area' | 'donut' | 'gauge' | 'funnel' | 'heatmap' | 'spark';
export type Series = { name: string; values: (number | null)[] };
export type ChartBlock = { title: string; chart: ChartKind; x: (string | number)[] | null; series: Series[]; unit: string; decimals: number | null; xLabel: string; max: number };

export type KpiItem = { label: string; value: number | string; unit: string; decimals: number | null; basis: string; delta: number | null; deltaUnit: string; better: Better };
export type KpiBlock = { title: string; items: KpiItem[] };
export type CompareItem = { label: string; before: number; after: number; unit: string; decimals: number | null; better: Better };
export type CompareBlock = { title: string; beforeLabel: string; afterLabel: string; items: CompareItem[] };

export type DiagramKind = 'flow' | 'org' | 'timeline' | 'gantt' | 'relation' | 'architecture';
export type NodeShape = 'step' | 'decision' | 'start' | 'end';
export type DiagramNode = { id: string; label: string; detail: string; tone: Tone | null; lane: string; shape: NodeShape | null; parent: string | null; date: string; start: string; end: string };
export type DiagramEdge = { from: string; to: string; label: string };
export type DiagramBlock = { title: string; kind: DiagramKind; lanes: string[]; nodes: DiagramNode[]; edges: DiagramEdge[]; today: string | null };

export type ArtifactBlock = { title: string; html: string; change: string };
export type CalloutBlock = { title: string; items: { tone: Tone; heading: string; text: string }[] };
export type ChecklistBlock = { title: string; items: { label: string; done: boolean; note: string }[] };
export type ProgressBlock = { title: string; items: { label: string; value: number; total: number; unit: string; tone: Tone | null }[] };
export type AccordionBlock = { title: string; items: { title: string; body: string; open: boolean }[] };
export type OptionsBlock = { title: string; options: string[]; rows: { label: string; values: (string | number | null)[]; tones: (Tone | null)[] }[] };
export type CodeBlock = { title: string; language: string; code: string };
export type GalleryBlock = { title: string; items: { attachment: number; caption: string }[] };
export type RecordBlock = { title: string; model: string; id: number; label: string; fields: string[] | null };
export type RepliesBlock = { title: string; summary: string; replies: string[] };
export type FieldKind = 'date' | 'text' | 'choice' | 'people';
export type FormField = { name: string; label: string; kind: FieldKind; choices: string[]; required: boolean; value: string | string[] };
export type FormBlock = { title: string; submitLabel: string; fields: FormField[] };

export type Parsed =
  | { state: 'broken'; raw: string }
  | { state: 'read'; frame: Frame; data: Obj };

const MAX_TITLE = 120;
const MAX_SUMMARY = 400;
const MAX_SOURCES = 10;
const MAX_LABEL = 120;
const REF_SHAPE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*,[1-9][0-9]*$/;
const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MODEL_SHAPE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const FIELD_SHAPE = /^[a-z][a-z0-9_]*$/;
const TONES: readonly Tone[] = ['good', 'warn', 'bad', 'info', 'neutral'];
const COLUMN_KINDS: readonly ColumnKind[] = ['text', 'number', 'money', 'date', 'status', 'spark'];
export const SUMMED: readonly ColumnKind[] = ['number', 'money'];
const CHART_KINDS: readonly ChartKind[] = ['bar', 'stacked_bar', 'line', 'area', 'stacked_area', 'donut', 'gauge', 'funnel', 'heatmap', 'spark'];
const DIAGRAM_KINDS: readonly DiagramKind[] = ['flow', 'org', 'timeline', 'gantt', 'relation', 'architecture'];
const SHAPES: readonly NodeShape[] = ['step', 'decision', 'start', 'end'];
const FIELD_KINDS: readonly FieldKind[] = ['date', 'text', 'choice', 'people'];
export const FALLBACK_COLUMNS = 12;
export const FALLBACK_ROWS = 500;

export function isObject(value: unknown): value is Obj {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const found = DATE_SHAPE.exec(value);
  if (!found) return false;
  const date = new Date(Date.UTC(Number(found[1]), Number(found[2]) - 1, Number(found[3])));
  return date.getUTCFullYear() === Number(found[1]) && date.getUTCMonth() === Number(found[2]) - 1 && date.getUTCDate() === Number(found[3]);
}

function absent(value: unknown): boolean {
  return value === undefined || value === null;
}

function isText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= limit;
}

function optionalText(value: unknown, limit: number): string | null {
  if (absent(value)) return '';
  return isText(value, limit) ? value : null;
}

function toneOf(value: unknown): Tone | null {
  return TONES.includes(value as Tone) ? (value as Tone) : null;
}

function decimalsOf(value: unknown): number | null | false {
  if (absent(value)) return null;
  return isInteger(value) && value >= 0 && value <= 6 ? value : false;
}

function betterOf(value: unknown): Better | false {
  if (absent(value)) return null;
  return value === 'up' || value === 'down' ? value : false;
}

function list(value: unknown, least: number, most: number): unknown[] | null {
  return Array.isArray(value) && value.length >= least && value.length <= most ? value : null;
}

function each<T>(items: unknown[] | null, read: (item: Obj) => T | null): T[] | null {
  if (!items) return null;
  const out: T[] = [];
  for (const item of items) {
    if (!isObject(item)) return null;
    const one = read(item);
    if (one === null) return null;
    out.push(one);
  }
  return out;
}

function sourcesOf(value: unknown): Source[] | null {
  if (absent(value)) return [];
  const items = list(value, 0, MAX_SOURCES);
  return each(items, (source) => {
    if (!isText(source.label, MAX_LABEL)) return null;
    if (!absent(source.ref) && !(typeof source.ref === 'string' && REF_SHAPE.test(source.ref))) return null;
    return { label: source.label, ref: typeof source.ref === 'string' ? source.ref : '' };
  });
}

function looseSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_SOURCES)
    .filter(isObject)
    .map((source) => ({ label: typeof source.label === 'string' ? source.label.trim().slice(0, MAX_LABEL) : '', ref: typeof source.ref === 'string' ? source.ref : '' }))
    .filter((source) => source.label);
}

function shortText(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function parseBlock(raw: string): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: 'broken', raw };
  }
  if (!isObject(data)) return { state: 'broken', raw };
  return {
    state: 'read',
    data,
    frame: {
      type: typeof data.type === 'string' ? data.type : '',
      title: shortText(data.title, MAX_TITLE),
      summary: shortText(data.summary, MAX_SUMMARY),
      sources: looseSources(data.sources),
    },
  };
}

export function frameIsSound(data: Obj): boolean {
  return isText(data.summary, MAX_SUMMARY) && optionalText(data.title, MAX_TITLE) !== null && sourcesOf(data.sources) !== null;
}

function cellOf(value: unknown): string | null {
  if (absent(value)) return null;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function plainTable(title: string, names: unknown[], rows: unknown[][]): TableBlock | null {
  const columns: Column[] = names
    .slice(0, FALLBACK_COLUMNS)
    .map((name) => ({ name: String(name || '-').slice(0, 60), kind: 'text', unit: '', decimals: null, total: false, tones: null }));
  if (!columns.length || !rows.length) return null;
  return { title, columns, rows: rows.slice(0, FALLBACK_ROWS).map((row) => columns.map((_, position) => cellOf(row[position]))), rowCount: null };
}

export function fallbackTable(data: Obj, title: string): TableBlock | null {
  if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
    const names = data.columns.map((column) => (isObject(column) ? (column.name ?? column.label) : column));
    const rows = data.rows.map((row) => (Array.isArray(row) ? row : isObject(row) ? Object.values(row) : [row]));
    return plainTable(title, names, rows);
  }
  if (Array.isArray(data.x) && Array.isArray(data.series)) {
    const series = data.series.filter(isObject);
    const names = [data.x_label || '', ...series.map((line) => line.name)];
    const rows = data.x.map((label, position) => [label, ...series.map((line) => (Array.isArray(line.values) ? line.values[position] : null))]);
    return plainTable(title, names, rows);
  }
  const items = [data.items, data.rows, data.nodes].find(Array.isArray);
  if (items && items.length && items.every(isObject)) {
    const names = [...new Set(items.flatMap((item) => Object.keys(item)))];
    return plainTable(title, names, items.map((item) => names.map((name) => item[name])));
  }
  return null;
}

function columnOf(column: Obj): Column | null {
  const kind = absent(column.kind) ? 'text' : column.kind;
  if (!isText(column.name, 60) || !COLUMN_KINDS.includes(kind as ColumnKind)) return null;
  const typed = kind as ColumnKind;
  const unit = optionalText(column.unit, 16);
  const decimals = decimalsOf(column.decimals);
  if (unit === null || decimals === false) return null;
  if (!absent(column.total) && (typeof column.total !== 'boolean' || (column.total && !SUMMED.includes(typed)))) return null;
  let tones: Record<string, Tone> | null = null;
  if (!absent(column.tones)) {
    if (typed !== 'status' || !isObject(column.tones) || Object.values(column.tones).some((tone) => !toneOf(tone))) return null;
    tones = column.tones as Record<string, Tone>;
  }
  return { name: column.name, kind: typed, unit, decimals, total: column.total === true, tones };
}

function cellFits(cell: unknown, kind: ColumnKind): boolean {
  if (cell === null) return true;
  if (kind === 'spark') return Array.isArray(cell) && cell.length >= 2 && cell.length <= 60 && cell.every((value) => value === null || isNumber(value));
  if (SUMMED.includes(kind)) return isNumber(cell);
  if (typeof cell === 'object') return false;
  if (kind === 'date') return isDate(cell);
  if (kind === 'status' && typeof cell !== 'string') return false;
  return !(typeof cell === 'string' && cell.length > 500);
}

export function readTable(data: Obj): TableBlock | null {
  const columns = each(list(data.columns, 1, 12), columnOf);
  const rows = Array.isArray(data.rows) && data.rows.length <= 500 ? data.rows : null;
  if (!columns || !rows) return null;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== columns.length) return null;
    if (!row.every((cell, position) => cellFits(cell, columns[position].kind))) return null;
  }
  const count = data.row_count;
  if (!absent(count) && (!isInteger(count) || count < rows.length)) return null;
  return { title: shortText(data.title, MAX_TITLE), columns, rows: rows as Cell[][], rowCount: isInteger(count) ? count : null };
}

function valuesFit(values: unknown, chart: ChartKind, length: number | null): values is (number | null)[] {
  if (chart === 'gauge') return Array.isArray(values) && values.length === 1 && isNumber(values[0]);
  if (!Array.isArray(values)) return false;
  if (length !== null && values.length !== length) return false;
  if (chart === 'spark' && values.length < 2) return false;
  const whole = chart === 'donut' || chart === 'funnel';
  return values.every((value) => {
    if (value === null && !whole) return true;
    if (!isNumber(value)) return false;
    return !(value < 0 && (whole || chart === 'stacked_bar' || chart === 'stacked_area'));
  });
}

export function readChart(data: Obj): ChartBlock | null {
  const chart = data.chart as ChartKind;
  if (!CHART_KINDS.includes(chart)) return null;
  const unit = optionalText(data.unit, 16);
  const decimals = decimalsOf(data.decimals);
  const xLabel = optionalText(data.x_label, 60);
  if (unit === null || decimals === false || xLabel === null) return null;
  const most = ({ heatmap: 40, gauge: 4, donut: 1, funnel: 1, spark: 1 } as Partial<Record<ChartKind, number>>)[chart] ?? 6;
  const series = list(data.series, 1, most);
  if (!series) return null;
  let x: (string | number)[] | null = null;
  let max = 0;
  if (chart === 'gauge') {
    if (!isNumber(data.max) || data.max <= 0) return null;
    max = data.max;
  } else if (!absent(data.x) || chart !== 'spark') {
    const labels = ({ heatmap: 60, donut: 6, funnel: 12 } as Partial<Record<ChartKind, number>>)[chart] ?? 5000;
    const read = list(data.x, 1, labels);
    if (!read || !read.every((label) => isNumber(label) || (typeof label === 'string' && label.length <= 60))) return null;
    x = read as (string | number)[];
  }
  const length = x && chart !== 'gauge' ? x.length : null;
  let points = 0;
  const lines = each(series, (line) => {
    if (!isText(line.name, 60) || !valuesFit(line.values, chart, length)) return null;
    points += line.values.length;
    return { name: line.name, values: line.values };
  });
  if (!lines || points > 5000) return null;
  if (chart === 'donut' && !(lines[0].values.reduce<number>((sum, value) => sum + (value ?? 0), 0) > 0)) return null;
  return { title: shortText(data.title, MAX_TITLE), chart, x, series: lines, unit, decimals, xLabel, max };
}

export function readKpi(data: Obj): KpiBlock | null {
  const items = each(list(data.items, 1, 6), (item) => {
    const value = item.value;
    if (!isText(item.label, 60)) return null;
    if (!isNumber(value) && !isText(value, 24)) return null;
    const basis = optionalText(item.basis, 120);
    const unit = optionalText(item.unit, 16);
    const deltaUnit = optionalText(item.delta_unit, 16);
    const decimals = decimalsOf(item.decimals);
    const better = betterOf(item.better);
    if (basis === null || unit === null || deltaUnit === null || decimals === false || better === false) return null;
    if (!absent(item.delta) && !isNumber(item.delta)) return null;
    return { label: item.label, value, unit, decimals, basis, delta: isNumber(item.delta) ? item.delta : null, deltaUnit, better };
  });
  return items ? { title: shortText(data.title, MAX_TITLE), items } : null;
}

export function readCompare(data: Obj): CompareBlock | null {
  const beforeLabel = optionalText(data.before_label, 40);
  const afterLabel = optionalText(data.after_label, 40);
  if (beforeLabel === null || afterLabel === null) return null;
  const items = each(list(data.items, 1, 20), (item) => {
    const unit = optionalText(item.unit, 16);
    const decimals = decimalsOf(item.decimals);
    const better = betterOf(item.better);
    if (!isText(item.label, 60) || !isNumber(item.before) || !isNumber(item.after) || unit === null || decimals === false || better === false) return null;
    return { label: item.label, before: item.before, after: item.after, unit, decimals, better };
  });
  return items ? { title: shortText(data.title, MAX_TITLE), beforeLabel, afterLabel, items } : null;
}

export function readDiagram(data: Obj): DiagramBlock | null {
  const kind = data.kind as DiagramKind;
  if (!DIAGRAM_KINDS.includes(kind)) return null;
  const laned = kind === 'flow' || kind === 'architecture';
  let lanes: string[] = [];
  if (laned) {
    const read = list(data.lanes, 1, 12);
    if (!read || !read.every((lane) => isText(lane, 40)) || new Set(read).size !== read.length) return null;
    lanes = read as string[];
  } else if (!absent(data.lanes)) return null;
  const known = new Set<string>();
  const nodes = each(list(data.nodes, 1, 60), (node) => {
    if (!isText(node.id, 40) || known.has(node.id) || !isText(node.label, 80)) return null;
    known.add(node.id);
    const detail = optionalText(node.detail, 60);
    if (detail === null) return null;
    if (!absent(node.tone) && !toneOf(node.tone)) return null;
    if (laned && !lanes.includes(node.lane as string)) return null;
    if (!absent(node.shape) && (kind !== 'flow' || !SHAPES.includes(node.shape as NodeShape))) return null;
    if (kind === 'timeline' && !isDate(node.date)) return null;
    if (kind === 'gantt' && (!isDate(node.start) || !isDate(node.end) || (node.end as string) < (node.start as string))) return null;
    if (!absent(node.parent) && kind !== 'org') return null;
    return {
      id: node.id,
      label: node.label,
      detail,
      tone: toneOf(node.tone),
      lane: laned ? (node.lane as string) : '',
      shape: absent(node.shape) ? null : (node.shape as NodeShape),
      parent: typeof node.parent === 'string' ? node.parent : null,
      date: kind === 'timeline' ? (node.date as string) : '',
      start: kind === 'gantt' ? (node.start as string) : '',
      end: kind === 'gantt' ? (node.end as string) : '',
    };
  });
  if (!nodes) return null;
  if (kind === 'org') {
    const parents = new Map<string, string>();
    for (const node of nodes) {
      if (node.parent === null) continue;
      if (!known.has(node.parent) || node.parent === node.id) return null;
      parents.set(node.id, node.parent);
    }
    for (const start of parents.keys()) {
      const seen = new Set([start]);
      for (let step = parents.get(start); step !== undefined; step = parents.get(step)) {
        if (seen.has(step)) return null;
        seen.add(step);
      }
    }
  }
  let edges: DiagramEdge[] = [];
  if (!absent(data.edges)) {
    if (kind === 'org' || kind === 'timeline') return null;
    const read = each(list(data.edges, 0, 120), (edge) => {
      if (!known.has(edge.from as string) || !known.has(edge.to as string) || edge.from === edge.to) return null;
      const label = optionalText(edge.label, 40);
      return label === null ? null : { from: edge.from as string, to: edge.to as string, label };
    });
    if (!read) return null;
    edges = read;
  }
  if (!absent(data.today) && (kind !== 'gantt' || !isDate(data.today))) return null;
  return { title: shortText(data.title, MAX_TITLE), kind, lanes, nodes, edges, today: isDate(data.today) ? data.today : null };
}

export function readArtifact(data: Obj): ArtifactBlock | null {
  if (!isText(data.title, MAX_TITLE) || typeof data.html !== 'string' || !data.html.trim()) return null;
  if (byteLength(data.html) > 256 * 1024) return null;
  const change = optionalText(data.change, 120);
  return change === null ? null : { title: data.title, html: data.html, change };
}

export function byteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

export function readCallout(data: Obj): CalloutBlock | null {
  const items = each(list(data.items, 1, 6), (item) => {
    const tone = toneOf(item.tone);
    return tone && isText(item.heading, 40) && isText(item.text, 400) ? { tone, heading: item.heading, text: item.text } : null;
  });
  return items ? { title: shortText(data.title, MAX_TITLE), items } : null;
}

export function readChecklist(data: Obj): ChecklistBlock | null {
  const items = each(list(data.items, 1, 20), (item) => {
    const note = optionalText(item.note, 120);
    return isText(item.label, 120) && typeof item.done === 'boolean' && note !== null ? { label: item.label, done: item.done, note } : null;
  });
  return items ? { title: shortText(data.title, MAX_TITLE), items } : null;
}

export function readProgress(data: Obj): ProgressBlock | null {
  const items = each(list(data.items, 1, 20), (item) => {
    const unit = optionalText(item.unit, 16);
    if (!isText(item.label, 120) || unit === null || !isNumber(item.value) || item.value < 0 || !isNumber(item.total) || item.total <= 0) return null;
    if (!absent(item.tone) && !toneOf(item.tone)) return null;
    return { label: item.label, value: item.value, total: item.total, unit, tone: toneOf(item.tone) };
  });
  return items ? { title: shortText(data.title, MAX_TITLE), items } : null;
}

export function readAccordion(data: Obj): AccordionBlock | null {
  const items = each(list(data.items, 1, 20), (item) => {
    if (!isText(item.title, 120) || !isText(item.body, 2000)) return null;
    if (!absent(item.open) && typeof item.open !== 'boolean') return null;
    return { title: item.title, body: item.body, open: item.open === true };
  });
  return items ? { title: shortText(data.title, MAX_TITLE), items } : null;
}

export function readOptions(data: Obj): OptionsBlock | null {
  const options = list(data.options, 2, 4);
  if (!options || !options.every((option) => isText(option, 40)) || new Set(options).size !== options.length) return null;
  const rows = each(list(data.rows, 1, 20), (row) => {
    if (!isText(row.label, 80) || !Array.isArray(row.values) || row.values.length !== options.length) return null;
    if (!row.values.every((value) => value === null || ((typeof value === 'string' || isNumber(value)) && String(value).length <= 120))) return null;
    let tones: (Tone | null)[] = options.map(() => null);
    if (!absent(row.tones)) {
      if (!Array.isArray(row.tones) || row.tones.length !== options.length || row.tones.some((tone) => tone !== null && !toneOf(tone))) return null;
      tones = row.tones.map(toneOf);
    }
    return { label: row.label, values: row.values as (string | number | null)[], tones };
  });
  return rows ? { title: shortText(data.title, MAX_TITLE), options: options as string[], rows } : null;
}

export function readCode(data: Obj): CodeBlock | null {
  if (!isText(data.language, 20) || !isText(data.code, 20000)) return null;
  if ((data.code.match(/\n/g) || []).length >= 400) return null;
  return { title: shortText(data.title, MAX_TITLE), language: data.language, code: data.code };
}

export function readGallery(data: Obj): GalleryBlock | null {
  const items = each(list(data.items, 1, 12), (item) => {
    const caption = optionalText(item.caption, 120);
    if (caption === null || !isInteger(item.attachment) || item.attachment < 1 || 'url' in item || 'src' in item) return null;
    return { attachment: item.attachment, caption };
  });
  return items ? { title: shortText(data.title, MAX_TITLE), items } : null;
}

export function readRecord(data: Obj): RecordBlock | null {
  if (!isText(data.label, 120) || typeof data.model !== 'string' || !MODEL_SHAPE.test(data.model) || !isInteger(data.id) || data.id < 1) return null;
  let fields: string[] | null = null;
  if (!absent(data.fields)) {
    const read = list(data.fields, 1, 6);
    if (!read || !read.every((name) => typeof name === 'string' && FIELD_SHAPE.test(name))) return null;
    fields = read as string[];
  }
  return { title: shortText(data.title, MAX_TITLE), model: data.model, id: data.id, label: data.label, fields };
}

export function readReplies(data: Obj): RepliesBlock | null {
  const replies = list(data.replies, 1, 4);
  if (!replies || !replies.every((reply) => isText(reply, 60)) || new Set(replies).size !== replies.length) return null;
  return { title: shortText(data.title, MAX_TITLE), summary: shortText(data.summary, MAX_SUMMARY), replies: replies as string[] };
}

function defaultOf(field: Obj, kind: FieldKind, choices: string[]): string | string[] | null {
  const value = field.value;
  if (absent(value)) return kind === 'people' ? [] : '';
  if (kind === 'date') return isDate(value) ? value : null;
  if (kind === 'text') return typeof value === 'string' && value.length <= 400 ? value : null;
  if (kind === 'choice') return choices.includes(value as string) ? (value as string) : null;
  if (!Array.isArray(value) || value.some((person) => typeof person !== 'string' || (choices.length > 0 && !choices.includes(person)))) return null;
  return value as string[];
}

export function readForm(data: Obj): FormBlock | null {
  if (!isText(data.submit_label, 40)) return null;
  const names = new Set<string>();
  const fields = each(list(data.fields, 1, 8), (field) => {
    const kind = field.kind as FieldKind;
    if (!isText(field.label, 60) || typeof field.name !== 'string' || !FIELD_SHAPE.test(field.name) || field.name.length > 40 || names.has(field.name)) return null;
    names.add(field.name);
    if (!FIELD_KINDS.includes(kind)) return null;
    if (!absent(field.required) && typeof field.required !== 'boolean') return null;
    let choices: string[] = [];
    if (kind === 'choice' || !absent(field.choices)) {
      const least = kind === 'choice' ? 2 : 1;
      if (kind !== 'choice' && kind !== 'people') return null;
      const read = list(field.choices, least, 12);
      if (!read || !read.every((choice) => isText(choice, 60))) return null;
      choices = read as string[];
    }
    const value = defaultOf(field, kind, choices);
    if (value === null) return null;
    return { name: field.name, label: field.label, kind, choices, required: field.required === true, value };
  });
  return fields ? { title: shortText(data.title, MAX_TITLE), submitLabel: data.submit_label, fields } : null;
}
