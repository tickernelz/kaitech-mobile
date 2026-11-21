import { decodeEntities, type Span } from './html';

export type Item = { marker: string; depth: number; spans: Span[] };
export type Align = 'left' | 'center' | 'right';
export type MdBlock =
  | { kind: 'text'; spans: Span[]; heading: boolean }
  | { kind: 'list'; items: Item[] }
  | { kind: 'quote'; blocks: MdBlock[] }
  | { kind: 'code'; text: string }
  | { kind: 'table'; head: Span[][]; rows: Span[][][]; align: Align[] };

type Style = Omit<Span, 'text'>;
type Context = { atoms: Span[]; tables: boolean };

const ATOM_BASE = 0xe000;
const ATOM_LIMIT = 0x1900;
const PRIVATE = /[\ue000-\uf8ff]/g;
const QUOTE_DEPTH = 4;

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(\S.*)$/;
const DELIMITER = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const ESCAPABLE = '\\`*_~[]()#>|-+.!{}';
const WORD = /[0-9A-Za-z\u00c0-\u024f]/;
const SPACE = /\s/;
const URL = /https?:\/\/[^\s<>"'\ue000-\uf8ff]*[^\s<>"'.,;:!?)\]*_~\ue000-\uf8ff]/y;
const SCHEMES = /^(https?:\/\/|mailto:|tel:)\S+$/i;
const STYLES: Record<string, Style> = { '**': { bold: true }, '*': { italic: true }, _: { italic: true }, '~~': { strike: true } };

export function parseMarkdown(source: string, options: { tables?: boolean; atoms?: Span[] } = {}): MdBlock[] {
  const context: Context = { atoms: options.atoms ?? [], tables: !!options.tables };
  return blocksOf(source.replace(/\r\n?/g, '\n').split('\n'), context, 0);
}

function tableStart(line: string, next: string | undefined): boolean {
  return next !== undefined && line.includes('|') && next.includes('|') && DELIMITER.test(next);
}

function startsBlock(lines: string[], index: number, context: Context): boolean {
  const line = lines[index];
  return FENCE.test(line) || HEADING.test(line) || QUOTE.test(line) || ITEM.test(line) || (context.tables && tableStart(line, lines[index + 1]));
}

function closesFence(line: string, mark: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= mark.length && trimmed === mark[0].repeat(trimmed.length) && /^ {0,3}\S/.test(line);
}

function depthOf(indent: string): number {
  return Math.min(3, Math.floor(indent.replace(/\t/g, '    ').length / 2));
}

function blocksOf(lines: string[], context: Context, depth: number): MdBlock[] {
  const blocks: MdBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      let end = index + 1;
      while (end < lines.length && !closesFence(lines[end], fence[1])) end += 1;
      blocks.push({ kind: 'code', text: atomText(lines.slice(index + 1, end).join('\n'), context) });
      index = end + 1;
      continue;
    }
    if (depth < QUOTE_DEPTH && QUOTE.test(line)) {
      const inner: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index])) {
        inner.push((QUOTE.exec(lines[index]) as RegExpExecArray)[1]);
        index += 1;
      }
      const quoted = blocksOf(inner, context, depth + 1);
      if (quoted.length) blocks.push({ kind: 'quote', blocks: quoted });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'text', heading: true, spans: inline(heading[1], context) });
      index += 1;
      continue;
    }
    if (ITEM.test(line)) {
      const items: { marker: string; depth: number; text: string }[] = [];
      while (index < lines.length) {
        const item = ITEM.exec(lines[index]);
        if (item) {
          items.push({ marker: /\d/.test(item[2]) ? item[2] : '', depth: depthOf(item[1]), text: item[3].trimEnd() });
        } else if (/^[ \t]{2,}\S/.test(lines[index]) && !startsBlock(lines, index, context)) {
          items[items.length - 1].text += `\n${lines[index].trim()}`;
        } else {
          break;
        }
        index += 1;
      }
      blocks.push({ kind: 'list', items: items.map((item) => ({ marker: item.marker, depth: item.depth, spans: inline(item.text, context) })) });
      continue;
    }
    if (context.tables && tableStart(line, lines[index + 1])) {
      const head = cellsOf(line);
      const align = cellsOf(lines[index + 1]).map(alignOf);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(cellsOf(lines[index]));
        index += 1;
      }
      const width = head.length;
      blocks.push({
        kind: 'table',
        head: head.map((cell) => inline(cell, context)),
        rows: rows.map((row) => Array.from({ length: width }, (_, column) => inline(row[column] ?? '', context))),
        align: Array.from({ length: width }, (_, column) => align[column] ?? 'left'),
      });
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines, index, context)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ kind: 'text', heading: false, spans: inline(paragraph.join('\n'), context) });
  }
  return blocks;
}

function cellsOf(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let ticks = 0;
  const text = line.trim();
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '\\' && text[index + 1] === '|') {
      cell += '|';
      index += 1;
    } else if (char === '`') {
      ticks = ticks ? 0 : 1;
      cell += char;
    } else if (char === '|' && !ticks) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  if (text.startsWith('|')) cells.shift();
  if (text.endsWith('|') && !text.endsWith('\\|') && cells.length > 1) cells.pop();
  return cells.map((value) => value.trim());
}

function alignOf(cell: string): Align {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  return left && right ? 'center' : right ? 'right' : 'left';
}

function isAtom(code: number, context: Context): boolean {
  return code >= ATOM_BASE && code < ATOM_BASE + context.atoms.length;
}

function atomText(text: string, context: Context): string {
  if (!context.atoms.length) return text;
  return text.replace(PRIVATE, (char) => {
    const code = char.charCodeAt(0);
    return isAtom(code, context) ? context.atoms[code - ATOM_BASE].text : char;
  });
}

export function sameStyle(a: Style, b: Style): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.strike === !!b.strike &&
    !!a.code === !!b.code &&
    a.href === b.href &&
    a.mention?.model === b.mention?.model &&
    a.mention?.id === b.mention?.id
  );
}

function add(spans: Span[], span: Span) {
  if (!span.text) return;
  const last = spans[spans.length - 1];
  if (last && sameStyle(last, span)) last.text += span.text;
  else spans.push(span);
}

function runLength(text: string, from: number, char: string): number {
  let end = from;
  while (text[end] === char) end += 1;
  return end - from;
}

function findTicks(text: string, from: number, length: number): number {
  let index = text.indexOf('`', from);
  while (index >= 0) {
    const run = runLength(text, index, '`');
    if (run === length) return index;
    index = text.indexOf('`', index + run);
  }
  return -1;
}

function delimiterAt(text: string, index: number): string | null {
  const char = text[index];
  if (char === '*') return text[index + 1] === '*' ? '**' : '*';
  if (char === '~') return text[index + 1] === '~' ? '~~' : null;
  if (char === '_') return '_';
  return null;
}

function canOpen(text: string, index: number, mark: string): boolean {
  if (mark === '_' && (text[index + 1] === '_' || text[index - 1] === '_')) return false;
  const after = text[index + mark.length];
  if (after === undefined || SPACE.test(after)) return false;
  return mark.length > 1 || !WORD.test(text[index - 1] ?? '');
}

function findCloser(text: string, from: number, mark: string): number {
  for (let index = from; index < text.length; index++) {
    const char = text[index];
    if (char === '\n') return -1;
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '`') {
      const run = runLength(text, index, '`');
      const close = findTicks(text, index + run, run);
      index = (close >= 0 ? close : index) + run - 1;
      continue;
    }
    if (!text.startsWith(mark, index)) continue;
    if (mark === '*' && text[index + 1] === '*') {
      index += runLength(text, index, '*') - 1;
      continue;
    }
    if (mark === '_' && (text[index + 1] === '_' || text[index - 1] === '_')) {
      index += runLength(text, index, '_') - 1;
      continue;
    }
    if (index === from || SPACE.test(text[index - 1])) continue;
    if (mark.length === 1 && WORD.test(text[index + 1] ?? '')) continue;
    if (mark === '**') while (text[index + 2] === '*') index += 1;
    return index;
  }
  return -1;
}

function linkAt(text: string, index: number, context: Context): { label: string; href: string; end: number } | null {
  const close = text.indexOf(']', index + 1);
  if (close < 0 || text[close + 1] !== '(') return null;
  const label = text.slice(index + 1, close);
  if (!label.trim() || label.includes('\n') || label.includes('[')) return null;
  const end = text.indexOf(')', close + 2);
  if (end < 0) return null;
  let target = text.slice(close + 2, end).trim();
  const code = target.charCodeAt(0);
  if (target.length === 1 && isAtom(code, context)) target = context.atoms[code - ATOM_BASE].href ?? '';
  if (!SCHEMES.test(target) || /[\ue000-\uf8ff]/.test(target)) return null;
  return { label, href: target, end: end + 1 };
}

function codeText(raw: string, context: Context): string {
  const text = raw.length > 2 && raw.startsWith(' ') && raw.endsWith(' ') && raw.trim() ? raw.slice(1, -1) : raw;
  return atomText(text, context);
}

function inline(text: string, context: Context, base: Style = {}, links = true): Span[] {
  const spans: Span[] = [];
  let plain = '';
  const flush = () => {
    if (plain) add(spans, { ...base, text: plain });
    plain = '';
  };
  const nest = (inner: Span[]) => {
    flush();
    inner.forEach((span) => add(spans, span));
  };
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const code = text.charCodeAt(index);
    if (char === '\\' && index + 1 < text.length && ESCAPABLE.includes(text[index + 1])) {
      plain += text[index + 1];
      index += 2;
      continue;
    }
    if (isAtom(code, context)) {
      nest([{ ...base, ...context.atoms[code - ATOM_BASE] }]);
      index += 1;
      continue;
    }
    if (char === '`') {
      const run = runLength(text, index, '`');
      const close = findTicks(text, index + run, run);
      if (close >= 0) {
        nest([{ ...base, code: true, text: codeText(text.slice(index + run, close), context) }]);
        index = close + run;
      } else {
        plain += text.slice(index, index + run);
        index += run;
      }
      continue;
    }
    if (links && char === '[') {
      const link = linkAt(text, index, context);
      if (link) {
        nest(inline(link.label, context, { ...base, href: link.href }, false));
        index = link.end;
        continue;
      }
    }
    if (links && char === 'h' && !WORD.test(text[index - 1] ?? '')) {
      URL.lastIndex = index;
      const url = URL.exec(text);
      if (url) {
        nest([{ ...base, href: url[0], text: url[0] }]);
        index += url[0].length;
        continue;
      }
    }
    const mark = delimiterAt(text, index);
    if (mark && canOpen(text, index, mark)) {
      const close = findCloser(text, index + mark.length, mark);
      if (close >= 0) {
        nest(inline(text.slice(index + mark.length, close), context, { ...base, ...STYLES[mark] }, links));
        index = close + mark.length;
        continue;
      }
    }
    if (mark) {
      plain += mark;
      index += mark.length;
      continue;
    }
    plain += char;
    index += 1;
  }
  flush();
  return spans;
}

type Piece = { text: string; item: boolean; quote: number };

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'ul', 'ol', 'li', 'blockquote', 'pre']);
const HIDDEN_TAGS = new Set(['script', 'style', 'head', 'title']);

function styleOf(tag: string, attrs: string): Style {
  if (tag === 'b' || tag === 'strong') return { bold: true };
  if (tag === 'i' || tag === 'em') return { italic: true };
  if (tag === 's' || tag === 'del' || tag === 'strike') return { strike: true };
  if (tag === 'code') return { code: true };
  if (tag !== 'a') return {};
  const model = attribute(attrs, 'data-oe-model');
  const id = Number(attribute(attrs, 'data-oe-id'));
  if (model && Number.isInteger(id) && id > 0) return { mention: { model, id } };
  const href = attribute(attrs, 'href');
  return href && SCHEMES.test(href) ? { href } : {};
}

function attribute(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return match ? decodeEntities(match[2] ?? match[3] ?? match[4] ?? '') : null;
}

function isTable(lines: string[]): boolean {
  const rows = lines.filter((line) => line.trim());
  return rows.length >= 2 && rows.every((line) => line.trim().startsWith('|')) && DELIMITER.test(rows[1]);
}

function fenced(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}\n${text}\n${fence}`;
}

export function markdownOfHtml(html: string): { source: string; atoms: Span[]; tables: boolean } {
  const atoms: Span[] = [];
  const pieces: Piece[] = [];
  const stack: { tag: string; style: Style }[] = [];
  const lists: { ordered: boolean; next: number }[] = [];
  let buffer = '';
  let marker = '';
  let quote = 0;
  let hidden = 0;
  let pre = 0;
  let tables = false;

  const style = (): Style => stack.reduce<Style>((current, entry) => ({ ...current, ...entry.style }), {});
  const prefixed = (lines: string[], first: string): string => {
    const quoteMark = '> '.repeat(quote);
    const hang = ' '.repeat(first.length);
    return lines.map((line, index) => `${quoteMark}${index ? hang : first}${line}`.trimEnd() || quoteMark.trimEnd()).join('\n');
  };
  const flush = () => {
    const text = buffer.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/^[ \n]+|[ \n]+$/g, '');
    buffer = '';
    if (text) pieces.push({ text: prefixed(text.split('\n'), marker), item: !!marker && !marker.startsWith('#'), quote });
    marker = '';
  };
  const flushPre = () => {
    const lines = buffer.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    buffer = '';
    if (!lines.some((line) => line.trim())) return;
    const table = isTable(lines);
    tables = tables || table;
    pieces.push({ text: prefixed((table ? lines.join('\n') : fenced(lines.join('\n'))).split('\n'), ''), item: false, quote });
  };
  const write = (text: string) => {
    if (!text) return;
    const current = style();
    if (pre || !Object.keys(current).length || atoms.length >= ATOM_LIMIT) {
      buffer += text;
      return;
    }
    const lastCode = buffer.charCodeAt(buffer.length - 1);
    const last = atoms[atoms.length - 1];
    if (last && lastCode === ATOM_BASE + atoms.length - 1 && sameStyle(last, current)) {
      last.text += text;
      return;
    }
    atoms.push({ ...current, text });
    buffer += String.fromCharCode(ATOM_BASE + atoms.length - 1);
  };

  const pattern = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|</g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const [whole, closing, rawTag, attrs, text] = match;
    if (text !== undefined || whole === '<') {
      if (hidden) continue;
      const decoded = decodeEntities(text ?? whole).replace(PRIVATE, '\ufffd');
      write(pre ? decoded : decoded.replace(/[\t\r\n ]+/g, ' '));
      continue;
    }
    if (!rawTag) continue;
    const tag = rawTag.toLowerCase();
    if (HIDDEN_TAGS.has(tag)) {
      hidden = Math.max(0, hidden + (closing ? -1 : 1));
      continue;
    }
    if (hidden) continue;
    if (tag === 'br') {
      buffer += '\n';
      continue;
    }
    if (tag === 'td' || tag === 'th') {
      buffer += ' ';
      continue;
    }
    if (tag === 'pre') {
      if (closing) {
        if (pre) flushPre();
        pre = Math.max(0, pre - 1);
      } else {
        if (!pre) flush();
        pre += 1;
      }
      continue;
    }
    if (BLOCK_TAGS.has(tag)) {
      if (pre) continue;
      flush();
      if (tag === 'blockquote') quote = Math.max(0, quote + (closing ? -1 : 1));
      if (tag === 'ul' || tag === 'ol') {
        if (closing) lists.pop();
        else lists.push({ ordered: tag === 'ol', next: Math.max(1, Number(attribute(attrs, 'start')) || 1) });
      }
      if (!closing && tag === 'li') {
        const list = lists[lists.length - 1];
        const indent = '  '.repeat(Math.max(0, lists.length - 1));
        marker = `${indent}${list?.ordered ? `${list.next++}. ` : '- '}`;
      }
      if (!closing && /^h[1-6]$/.test(tag)) marker = '# ';
      continue;
    }
    if (closing) {
      const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) stack.splice(index);
      continue;
    }
    if (/\/\s*$/.test(attrs)) continue;
    stack.push({ tag, style: styleOf(tag, attrs) });
  }
  if (pre) flushPre();
  else flush();

  let source = '';
  pieces.forEach((piece, index) => {
    if (index) {
      const previous = pieces[index - 1];
      const shared = Math.min(previous.quote, piece.quote);
      source += piece.item && previous.item && previous.quote === piece.quote ? '\n' : `\n${'> '.repeat(shared).trimEnd()}\n`;
    }
    source += piece.text;
  });
  return { source, atoms, tables };
}

const CACHE_LIMIT = 500;
const cache = new Map<string, MdBlock[]>();

function cached(key: string, parse: () => MdBlock[]): MdBlock[] {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const blocks = parse();
  cache.set(key, blocks);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return blocks;
}

export function bodyBlocks(html: string): MdBlock[] {
  return cached(`h${html}`, () => {
    const { source, atoms, tables } = markdownOfHtml(html);
    return parseMarkdown(source, { atoms, tables });
  });
}

export function sourceBlocks(source: string, tables: boolean): MdBlock[] {
  return cached(`${tables ? 't' : 's'}${source}`, () => parseMarkdown(source, { tables }));
}

function spansText(spans: Span[]): string {
  return spans.map((span) => span.text).join('');
}

export function plainOf(blocks: MdBlock[]): string {
  const parts: string[] = [];
  const walk = (list: MdBlock[]) => {
    for (const block of list) {
      if (block.kind === 'text') parts.push(spansText(block.spans));
      else if (block.kind === 'list') block.items.forEach((item) => parts.push(spansText(item.spans)));
      else if (block.kind === 'quote') walk(block.blocks);
      else if (block.kind === 'code') parts.push(block.text);
      else [block.head, ...block.rows].forEach((row) => row.forEach((cell) => parts.push(spansText(cell))));
    }
  };
  walk(blocks);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function bodyPreview(html: string): string {
  return plainOf(bodyBlocks(html));
}
