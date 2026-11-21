const FENCE_LINE = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/;
const BLOCK_LANGUAGE = 'kt-block';
const MAX_TITLE = 120;
const MAX_SUMMARY = 400;
const MAX_SOURCES = 10;
const MAX_LABEL = 120;
const MAX_REPLIES = 4;
const MAX_REPLY = 60;
const TABLE_COLUMNS = 12;
export const TABLE_ROWS = 50;

export type Segment = { kind: 'text'; text: string } | { kind: 'block'; raw: string };

export type Source = { label: string; ref: string };

export type Table = { columns: string[]; rows: (string | null)[][]; hidden: number };

export type KtBlock =
  | { kind: 'replies'; title: string; summary: string; sources: Source[]; replies: string[] }
  | { kind: 'other'; title: string; summary: string; sources: Source[]; table: Table | null }
  | { kind: 'unreadable' };

export function splitBlocks(source: string): Segment[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const segments: Segment[] = [];
  let prose: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const opening = FENCE_LINE.exec(lines[index]);
    if (!opening) {
      prose.push(lines[index]);
      index += 1;
      continue;
    }
    let closingAt = lines.length;
    for (let position = index + 1; position < lines.length; position++) {
      const closing = FENCE_LINE.exec(lines[position]);
      if (closing && closing[1][0] === opening[1][0] && closing[1].length >= opening[1].length) {
        closingAt = position;
        break;
      }
    }
    if (opening[2].toLowerCase() === BLOCK_LANGUAGE) {
      if (prose.length) segments.push({ kind: 'text', text: prose.join('\n') });
      prose = [];
      segments.push({ kind: 'block', raw: lines.slice(index + 1, closingAt).join('\n') });
    } else {
      prose.push(...lines.slice(index, closingAt + 1));
    }
    index = closingAt + 1;
  }
  if (prose.length) segments.push({ kind: 'text', text: prose.join('\n') });
  return segments;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textOf(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function sourcesOf(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_SOURCES)
    .filter(isObject)
    .map((source) => ({ label: textOf(source.label, MAX_LABEL), ref: typeof source.ref === 'string' ? source.ref : '' }))
    .filter((source) => source.label);
}

function repliesOf(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_REPLIES) return null;
  if (!value.every((reply) => typeof reply === 'string' && reply.trim() && reply.length <= MAX_REPLY)) return null;
  return new Set(value).size === value.length ? (value as string[]) : null;
}

function cellOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function tableOf(names: unknown[], rows: unknown[][]): Table | null {
  const columns = names.slice(0, TABLE_COLUMNS).map((name) => String(name || '-').slice(0, 60));
  if (!columns.length || !rows.length) return null;
  return {
    columns,
    rows: rows.slice(0, TABLE_ROWS).map((row) => columns.map((_, position) => cellOf(row[position]))),
    hidden: Math.max(0, rows.length - TABLE_ROWS),
  };
}

export function fallbackTable(data: Record<string, unknown>): Table | null {
  if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
    const names = data.columns.map((column) => (isObject(column) ? (column.name ?? column.label) : column));
    const rows = data.rows.map((row) => (Array.isArray(row) ? row : isObject(row) ? Object.values(row) : [row]));
    return tableOf(names, rows);
  }
  if (Array.isArray(data.x) && Array.isArray(data.series)) {
    const series = data.series.filter(isObject);
    const names = [data.x_label || '', ...series.map((line) => line.name)];
    const rows = data.x.map((label, position) => [label, ...series.map((line) => (Array.isArray(line.values) ? line.values[position] : null))]);
    return tableOf(names, rows);
  }
  const items = [data.items, data.rows, data.nodes].find(Array.isArray);
  if (items && items.length && items.every(isObject)) {
    const names = [...new Set(items.flatMap((item) => Object.keys(item)))];
    return tableOf(names, items.map((item) => names.map((name) => item[name])));
  }
  return null;
}

export function readBlock(raw: string): KtBlock {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable' };
  }
  if (!isObject(data)) return { kind: 'unreadable' };
  const title = textOf(data.title, MAX_TITLE);
  const summary = textOf(data.summary, MAX_SUMMARY);
  const sources = sourcesOf(data.sources);
  const replies = data.type === 'replies' ? repliesOf(data.replies) : null;
  if (replies) return { kind: 'replies', title, summary, sources, replies };
  const table = fallbackTable(data);
  if (!title && !summary && !table) return { kind: 'unreadable' };
  return { kind: 'other', title, summary, sources, table };
}
