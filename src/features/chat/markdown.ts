import { decodeEntities, type Span } from './html';

export type Align = 'left' | 'center' | 'right';
export type Item = { spans: Span[]; sub: MdBlock[] };
export type MdBlock =
  | { kind: 'text'; spans: Span[] }
  | { kind: 'list'; ordered: boolean; start: number; items: Item[] }
  | { kind: 'quote'; blocks: MdBlock[] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; head: Span[][] | null; rows: Span[][][]; align: Align[] };

type Style = Omit<Span, 'text'>;
type Slot = Span;
type Context = { tables: boolean; slots: Slot[] };

const TEXT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\u00a0': '&nbsp;' };
const ATTRIBUTE_ESCAPES: Record<string, string> = { '&': '&amp;', '"': '&quot;', '\u00a0': '&nbsp;' };
const LIST_LINE = /^(\s*)([-*+]|[0-9]{1,9}[.)])\s+(.*)$/;
const HEADING_LINE = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const FENCE_LINE = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/;
const RULE_LINE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE_LINE = /^\s*>\s?(.*)$/;
const ROW_LINE = /^\s*\|(.+)\|\s*$/;
const DIVIDER_LINE = /^\s*\|[\s:|-]+\|\s*$/;
const KEEP = '\u0000';
const KEPT = /\u0000(\d+)\u0000/g;
const SLOT = /\uE000(\d+)\uE001/g;
const SLOT_ONLY = /^\uE000(\d+)\uE001$/;
const SLOT_MARKS = /[\uE000\uE001]/g;
const SLOT_MARK = /[\uE000\uE001]/;
const KEEP_MARKS = /\u0000/g;
const WORD = '\\p{L}\\p{N}_';
const CODE_SPAN = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g;
const ESCAPED = /\\([!-/:-@[-`{-~])/g;
const LINK = /\[([^[\]\n]+)\]\(([^\s()<>]+)(?:\s+"([^"<>\n]*)")?\)/g;
const BARE_URL = /\bhttps?:\/\/[^\s<>"\u0000\uE000\uE001]+/gi;
const URL_TAIL = /[.,:;!?'"*_~]$/;
const STRONG = /\*\*(?=[^\s*])([\s\S]*?[^\s*])\*\*/g;
const STRONG_UNDERSCORE = new RegExp(`(^|[^${WORD}])__(?=[^\\s_])([\\s\\S]*?[^\\s_])__(?![${WORD}])`, 'gu');
const STRUCK = /~~(?=[^\s~])([^~\n]*?[^\s~])~~/g;
const EMPHASIS = new RegExp(`(^|[^*${WORD}])\\*(?=[^\\s*])([^*\\n]*?[^\\s*])\\*(?![*${WORD}])`, 'gu');
const EMPHASIS_UNDERSCORE = new RegExp(`(^|[^_${WORD}])_(?=[^\\s_])([^_\\n]*?[^\\s_])_(?![_${WORD}])`, 'gu');
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:)/i;
const COMPOSED_MARKS = /[*_~`>#|[\]\\]|^\s*(?:[-+]|\d{1,9}[.)])\s/m;

function escapeText(text: string): string {
  return text.replace(/[&<>\u00a0]/g, (character) => TEXT_ESCAPES[character]);
}

function escapeAttribute(text: string): string {
  return text.replace(/[&"\u00a0]/g, (character) => ATTRIBUTE_ESCAPES[character]);
}

function slotsAsText(html: string, slots: Slot[]): string {
  return html.replace(SLOT, (_whole, index: string) => escapeText(slots[Number(index)]?.text || ''));
}

function slotsAsPlain(text: string, slots: Slot[]): string {
  return text.replace(SLOT, (_whole, index: string) => slots[Number(index)]?.text || '');
}

function anchor(href: string, inner: string, title?: string): string {
  const titled = title ? ` title="${escapeAttribute(title)}"` : '';
  return `<a href="${escapeAttribute(href)}"${titled} target="_blank" rel="noreferrer noopener">${inner}</a>`;
}

function hrefOf(target: string, slots: Slot[]): string {
  const slot = SLOT_ONLY.exec(target);
  if (slot) return slots[Number(slot[1])]?.href || '';
  if (SLOT_MARK.test(target)) return '';
  return SAFE_HREF.test(target) ? target : '';
}

function trimUrl(url: string): { link: string; rest: string } {
  let link = url;
  while (link) {
    if (URL_TAIL.test(link)) link = link.slice(0, -1);
    else if (link.endsWith(')') && link.split('(').length < link.split(')').length) link = link.slice(0, -1);
    else break;
  }
  return { link, rest: url.slice(link.length) };
}

function emphasize(html: string): string {
  return html
    .replace(STRONG, '<strong>$1</strong>')
    .replace(STRONG_UNDERSCORE, '$1<strong>$2</strong>')
    .replace(STRUCK, '<del>$1</del>')
    .replace(EMPHASIS, '$1<em>$2</em>')
    .replace(EMPHASIS_UNDERSCORE, '$1<em>$2</em>');
}

function renderInline(text: string, context: Context): string {
  const kept: string[] = [];
  const keep = (html: string) => `${KEEP}${kept.push(html) - 1}${KEEP}`;
  let source = text.replace(CODE_SPAN, (_whole, _ticks, body: string) => keep(`<code>${slotsAsText(escapeText(body.trim()), context.slots)}</code>`));
  source = source.replace(ESCAPED, (_whole, character: string) => keep(escapeText(character)));
  source = source.replace(LINK, (whole, label: string, target: string, title?: string) => {
    const href = hrefOf(target, context.slots);
    return href ? keep(anchor(href, emphasize(escapeText(label)), title && slotsAsPlain(title, context.slots))) : whole;
  });
  source = source.replace(BARE_URL, (url) => {
    const { link, rest } = trimUrl(url);
    return link ? keep(anchor(link, escapeText(link))) + rest : url;
  });
  let html = emphasize(escapeText(source));
  while (html.includes(KEEP)) html = html.replace(KEPT, (_whole, index: string) => kept[Number(index)]);
  return html;
}

function renderParagraphText(text: string, context: Context): string {
  return text
    .split('\n')
    .map((line) => renderInline(line, context))
    .join('<br>');
}

function indentWidth(prefix: string): number {
  return prefix.replace(/\t/g, '    ').length;
}

function interruptsList(line: string): boolean {
  return QUOTE_LINE.test(line) || HEADING_LINE.test(line) || FENCE_LINE.test(line) || RULE_LINE.test(line);
}

type ListLine = { indent: number; ordered: boolean; number: number; text: string };

function collectListItems(lines: string[], start: number): { items: ListLine[]; next: number } {
  const items: ListLine[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      if (index + 1 < lines.length && LIST_LINE.test(lines[index + 1])) {
        index += 1;
        continue;
      }
      break;
    }
    const match = LIST_LINE.exec(line);
    if (!match) {
      if (!items.length || interruptsList(line)) break;
      items[items.length - 1].text += `\n${line.trim()}`;
      index += 1;
      continue;
    }
    const ordered = /^\d/.test(match[2]);
    items.push({ indent: indentWidth(match[1]), ordered, number: ordered ? parseInt(match[2], 10) : 0, text: match[3] });
    index += 1;
  }
  return { items, next: index };
}

function renderListLevel(items: ListLine[], start: number, context: Context): { html: string; next: number } {
  const indent = items[start].indent;
  const ordered = items[start].ordered;
  const cells: string[] = [];
  let index = start;
  while (index < items.length && items[index].indent >= indent) {
    if (items[index].indent > indent) {
      const nested = renderListLevel(items, index, context);
      cells[cells.length - 1] += nested.html;
      index = nested.next;
      continue;
    }
    if (items[index].ordered !== ordered) break;
    cells.push(renderParagraphText(items[index].text, context));
    index += 1;
  }
  const opening = !ordered ? '<ul>' : items[start].number === 1 ? '<ol>' : `<ol start="${items[start].number}">`;
  const body = cells.map((cell) => `<li>${cell}</li>`).join('');
  return { html: opening + body + (ordered ? '</ol>' : '</ul>'), next: index };
}

function renderList(lines: string[], start: number, context: Context): { html: string; next: number } {
  const collected = collectListItems(lines, start);
  let html = '';
  let index = 0;
  while (index < collected.items.length) {
    const level = renderListLevel(collected.items, index, context);
    html += level.html;
    index = level.next;
  }
  return { html, next: collected.next };
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function alignmentOf(cell: string): string {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return ' style="text-align:center"';
  if (right) return ' style="text-align:right"';
  return '';
}

function renderTable(lines: string[], start: number, context: Context): { html: string; next: number } {
  const headers = splitRow(lines[start]);
  const alignments = splitRow(lines[start + 1]).map(alignmentOf);
  let index = start + 2;
  const rows: string[][] = [];
  while (index < lines.length && ROW_LINE.test(lines[index])) {
    rows.push(splitRow(lines[index]));
    index += 1;
  }
  const head = headers.map((cell, position) => `<th${alignments[position] || ''}>${renderInline(cell, context)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${headers.map((_ignored, position) => `<td${alignments[position] || ''}>${renderInline(row[position] || '', context)}</td>`).join('')}</tr>`)
    .join('');
  return { html: `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`, next: index };
}

function renderFence(lines: string[], start: number, context: Context): { html: string; next: number } {
  const opening = FENCE_LINE.exec(lines[start]) as RegExpExecArray;
  const collected: string[] = [];
  let index = start + 1;
  while (index < lines.length) {
    const closing = FENCE_LINE.exec(lines[index]);
    if (closing && closing[1][0] === opening[1][0] && closing[1].length >= opening[1].length) {
      index += 1;
      break;
    }
    collected.push(lines[index]);
    index += 1;
  }
  return { html: `<pre><code>${slotsAsText(escapeText(collected.join('\n')), context.slots)}</code></pre>`, next: index };
}

function renderQuote(lines: string[], start: number, context: Context): { html: string; next: number } {
  const collected: string[] = [];
  let index = start;
  while (index < lines.length) {
    const match = QUOTE_LINE.exec(lines[index]);
    if (!match) break;
    collected.push(match[1]);
    index += 1;
  }
  return { html: `<blockquote>${renderBlocks(collected.join('\n'), context)}</blockquote>`, next: index };
}

function startsTable(lines: string[], index: number, context: Context): boolean {
  return context.tables && ROW_LINE.test(lines[index]) && index + 1 < lines.length && DIVIDER_LINE.test(lines[index + 1]);
}

function isBlockStart(lines: string[], index: number, context: Context): boolean {
  const line = lines[index];
  return (
    !line.trim() ||
    HEADING_LINE.test(line) ||
    FENCE_LINE.test(line) ||
    RULE_LINE.test(line) ||
    QUOTE_LINE.test(line) ||
    LIST_LINE.test(line) ||
    startsTable(lines, index, context)
  );
}

function renderBlocks(source: string, context: Context): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (FENCE_LINE.test(line)) {
      const fence = renderFence(lines, index, context);
      html += fence.html;
      index = fence.next;
      continue;
    }
    if (RULE_LINE.test(line) && !LIST_LINE.test(line)) {
      html += '<hr>';
      index += 1;
      continue;
    }
    const heading = HEADING_LINE.exec(line);
    if (heading) {
      html += `<p><strong>${renderInline(heading[2], context)}</strong></p>`;
      index += 1;
      continue;
    }
    if (QUOTE_LINE.test(line)) {
      const quote = renderQuote(lines, index, context);
      html += quote.html;
      index = quote.next;
      continue;
    }
    if (startsTable(lines, index, context)) {
      const table = renderTable(lines, index, context);
      html += table.html;
      index = table.next;
      continue;
    }
    if (LIST_LINE.test(line)) {
      const list = renderList(lines, index, context);
      html += list.html;
      index = list.next;
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && !isBlockStart(lines, index, context)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html += `<p>${renderParagraphText(paragraph.join('\n'), context)}</p>`;
  }
  return html;
}

export function markdownToHtml(source: string, { tables = true, slots = [] }: { tables?: boolean; slots?: Slot[] } = {}): string {
  return renderBlocks(String(source || '').replace(KEEP_MARKS, ''), { tables, slots });
}

type Element = { tag: string; attrs: string; children: Node[] };
type Node = Element | string;

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'col', 'source']);
const HIDDEN_TAGS = new Set(['script', 'style', 'head', 'title', 'template']);
const CLOSES_PARAGRAPH = new Set(['p', 'div', 'ul', 'ol', 'table', 'pre', 'blockquote', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

export function parseTree(html: string): Node[] {
  const root: Element = { tag: '', attrs: '', children: [] };
  const stack: Element[] = [root];
  const pattern = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|</g;
  let hidden: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const [whole, closing, rawTag, attrs, text] = match;
    const tag = rawTag?.toLowerCase();
    if (hidden) {
      if (closing && tag === hidden) hidden = null;
      continue;
    }
    const top = stack[stack.length - 1];
    if (text !== undefined || whole === '<') {
      top.children.push(decodeEntities(text ?? whole));
      continue;
    }
    if (!tag) continue;
    if (closing) {
      const at = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    if (HIDDEN_TAGS.has(tag)) {
      if (!/\/\s*$/.test(attrs)) hidden = tag;
      continue;
    }
    if (CLOSES_PARAGRAPH.has(tag) && top.tag === 'p') stack.pop();
    const element: Element = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(element);
    if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(attrs)) stack.push(element);
  }
  return root.children;
}

function attribute(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return match ? decodeEntities(match[2] ?? match[3] ?? match[4] ?? '') : null;
}

function textContent(nodes: Node[]): string {
  return nodes.map((node) => (typeof node === 'string' ? node : node.tag === 'br' ? '\n' : textContent(node.children))).join('');
}

function linkStyle(attrs: string): Style {
  const model = attribute(attrs, 'data-oe-model');
  const id = Number(attribute(attrs, 'data-oe-id'));
  if (model && Number.isInteger(id) && id > 0) return { mention: { model, id } };
  const href = attribute(attrs, 'href');
  return href && SAFE_HREF.test(href) ? { href } : {};
}

function slotOf(node: Element): Slot {
  if (node.tag === 'img') return { text: attribute(node.attrs, 'alt') ?? '' };
  const text = textContent(node.children);
  if (node.tag !== 'a') return { text };
  const style = linkStyle(node.attrs);
  const redirect = /(^|\s)o_mail_redirect(\s|$)/.test(attribute(node.attrs, 'class') ?? '');
  return redirect && style.href ? { text } : { ...style, text };
}

function composedText(nodes: Node[], slots: Slot[]): string | null {
  let source = '';
  for (const node of nodes) {
    if (typeof node === 'string') source += node.replace(SLOT_MARKS, '');
    else if (node.tag === 'br') source += '\n';
    else if (node.tag === 'a' || node.tag === 'span' || node.tag === 'img') {
      source += `\uE000${slots.length}\uE001`;
      slots.push(slotOf(node));
    } else return null;
  }
  return source;
}

export function composedSource(nodes: Node[]): { source: string; slots: Slot[] } | null {
  const top = nodes.filter((node) => typeof node !== 'string' || node.trim());
  const slots: Slot[] = [];
  const bare = top.length > 0 && top.every((node) => typeof node !== 'string' && node.tag === 'p' && !node.attrs.trim());
  const parts = bare ? top.map((node) => composedText((node as Element).children, slots)) : [composedText(top, slots)];
  if (parts.includes(null)) return null;
  return { source: parts.join('\n\n'), slots };
}

const INLINE_STYLES: Record<string, Style> = {
  strong: { bold: true },
  b: { bold: true },
  em: { italic: true },
  i: { italic: true },
  del: { strike: true },
  s: { strike: true },
  strike: { strike: true },
  code: { code: true },
};
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const PARAGRAPHS = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'center', 'address']);

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
  else spans.push({ ...span });
}

function trimSpans(spans: Span[]): Span[] {
  const out = spans.map((span) => ({ ...span, text: span.text.replace(/ *\n */g, '\n') }));
  while (out.length && !out[0].text.replace(/^[ \n]+/, '')) out.shift();
  while (out.length && !out[out.length - 1].text.replace(/[ \n]+$/, '')) out.pop();
  if (!out.length) return out;
  out[0] = { ...out[0], text: out[0].text.replace(/^[ \n]+/, '') };
  const end = out.length - 1;
  out[end] = { ...out[end], text: out[end].text.replace(/[ \n]+$/, '') };
  return out;
}

function isPipeTable(text: string): boolean {
  const rows = text.split('\n').filter((line) => line.trim());
  return rows.length >= 2 && ROW_LINE.test(rows[0]) && DIVIDER_LINE.test(rows[1]) && rows.every((line) => ROW_LINE.test(line));
}

function alignOf(attrs: string): Align {
  const style = (attribute(attrs, 'style') ?? '').replace(/\s/g, '').toLowerCase();
  return style.includes('text-align:center') ? 'center' : style.includes('text-align:right') ? 'right' : 'left';
}

class Builder {
  blocks: MdBlock[] = [];
  private spans: Span[] = [];

  constructor(private slots: Slot[]) {}

  flush() {
    const spans = trimSpans(this.spans);
    this.spans = [];
    if (spans.length) this.blocks.push({ kind: 'text', spans });
  }

  text(text: string, style: Style, pre: boolean) {
    const value = pre ? text : text.replace(/[\t\r\n ]+/g, ' ');
    if (!this.slots.length || !value.includes('\uE000')) {
      add(this.spans, { ...style, text: value });
      return;
    }
    let last = 0;
    for (const found of value.matchAll(SLOT)) {
      add(this.spans, { ...style, text: value.slice(last, found.index) });
      const slot = this.slots[Number(found[1])];
      if (slot) add(this.spans, { ...style, ...slot });
      last = (found.index ?? 0) + found[0].length;
    }
    add(this.spans, { ...style, text: value.slice(last) });
  }

  walk(nodes: Node[], style: Style) {
    for (const node of nodes) {
      if (typeof node === 'string') this.text(node, style, false);
      else this.element(node, style);
    }
  }

  private sub(nodes: Node[], style: Style): MdBlock[] {
    const builder = new Builder(this.slots);
    builder.walk(nodes, style);
    builder.flush();
    return builder.blocks;
  }

  private element(node: Element, style: Style) {
    const { tag } = node;
    if (tag === 'br') return add(this.spans, { ...style, text: '\n' });
    if (tag === 'img') return this.text(attribute(node.attrs, 'alt') ?? '', style, false);
    if (tag === 'a') return this.walk(node.children, { ...style, ...linkStyle(node.attrs) });
    if (INLINE_STYLES[tag]) return this.walk(node.children, { ...style, ...INLINE_STYLES[tag] });
    if (tag === 'hr') {
      this.flush();
      this.blocks.push({ kind: 'rule' });
      return;
    }
    if (tag === 'pre') {
      this.flush();
      const text = textContent(node.children).replace(/^\n/, '').replace(/\s+$/, '');
      if (!text.trim()) return;
      if (isPipeTable(text)) this.blocks.push(...htmlBlocks(markdownToHtml(text, { tables: true })));
      else this.blocks.push({ kind: 'code', text: slotsAsPlain(text, this.slots) });
      return;
    }
    if (tag === 'blockquote') {
      this.flush();
      const blocks = this.sub(node.children, style);
      if (blocks.length) this.blocks.push({ kind: 'quote', blocks });
      return;
    }
    if (tag === 'ul' || tag === 'ol' || tag === 'li') {
      this.flush();
      const list = this.list(tag === 'li' ? { tag: 'ul', attrs: '', children: [node] } : node, style);
      if (list.items.length) this.blocks.push(list);
      return;
    }
    if (tag === 'table') {
      this.flush();
      const table = this.table(node, style);
      if (table) this.blocks.push(table);
      return;
    }
    if (HEADINGS.has(tag) || PARAGRAPHS.has(tag)) {
      this.flush();
      this.walk(node.children, HEADINGS.has(tag) ? { ...style, bold: true } : style);
      this.flush();
      return;
    }
    this.walk(node.children, style);
  }

  private list(node: Element, style: Style): Extract<MdBlock, { kind: 'list' }> {
    const items: Item[] = [];
    for (const child of node.children) {
      if (typeof child === 'string') continue;
      const nodes = child.tag === 'li' ? child.children : [child];
      const blocks = this.sub(nodes, style);
      const spans: Span[] = [];
      const sub: MdBlock[] = [];
      for (const block of blocks) {
        if (block.kind === 'text') {
          if (spans.length) add(spans, { text: '\n' });
          block.spans.forEach((span) => add(spans, span));
        } else sub.push(block);
      }
      if (spans.length || sub.length) items.push({ spans, sub });
    }
    const start = Number(attribute(node.attrs, 'start'));
    return { kind: 'list', ordered: node.tag === 'ol', start: Number.isInteger(start) && start > 0 ? start : 1, items };
  }

  private table(node: Element, style: Style): Extract<MdBlock, { kind: 'table' }> | null {
    const rows: { header: boolean; cells: { spans: Span[]; align: Align; th: boolean }[] }[] = [];
    const visit = (nodes: Node[], header: boolean) => {
      for (const child of nodes) {
        if (typeof child === 'string') continue;
        if (child.tag === 'tr') {
          const cells = child.children
            .filter((cell): cell is Element => typeof cell !== 'string' && (cell.tag === 'td' || cell.tag === 'th'))
            .map((cell) => {
              const spans: Span[] = [];
              this.sub(cell.children, style).forEach((block, index) => {
                if (index) add(spans, { text: '\n' });
                if (block.kind === 'text') block.spans.forEach((span) => add(spans, span));
                else add(spans, { text: plainOf([block]) });
              });
              return { spans, align: alignOf(cell.attrs), th: cell.tag === 'th' };
            });
          rows.push({ header: header || (cells.length > 0 && cells.every((cell) => cell.th)), cells });
        } else if (child.tag === 'thead' || child.tag === 'tbody' || child.tag === 'tfoot') visit(child.children, child.tag === 'thead');
      }
    };
    visit(node.children, false);
    if (!rows.length) return null;
    const headed = rows[0].header;
    const head = headed ? rows[0] : null;
    const body = headed ? rows.slice(1) : rows;
    const width = Math.max(...rows.map((row) => row.cells.length));
    if (!width) return null;
    const pad = (row: (typeof rows)[number]) => Array.from({ length: width }, (_, column) => row.cells[column]?.spans ?? []);
    const alignFrom = head ?? body[0];
    return {
      kind: 'table',
      head: head ? pad(head) : null,
      rows: body.map(pad),
      align: Array.from({ length: width }, (_, column) => alignFrom?.cells[column]?.align ?? 'left'),
    };
  }
}

function treeBlocks(nodes: Node[], slots: Slot[] = []): MdBlock[] {
  const builder = new Builder(slots);
  builder.walk(nodes, {});
  builder.flush();
  return builder.blocks;
}

export function htmlBlocks(html: string, slots: Slot[] = []): MdBlock[] {
  return treeBlocks(parseTree(html), slots);
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
    const tree = parseTree(html);
    const composed = composedSource(tree);
    if (composed && COMPOSED_MARKS.test(composed.source)) return htmlBlocks(markdownToHtml(composed.source, { tables: false, slots: composed.slots }), composed.slots);
    return treeBlocks(tree);
  });
}

export function isFlatList(block: Extract<MdBlock, { kind: 'list' }>): boolean {
  return block.items.every((item) => item.sub.every((sub) => sub.kind === 'list' && isFlatList(sub)));
}

export function bodyShape(html: string): 'plain' | 'rich' | 'table' {
  const blocks = bodyBlocks(html);
  if (blocks.some((block) => block.kind === 'table')) return 'table';
  return blocks.every((block) => block.kind === 'text' || (block.kind === 'list' && isFlatList(block))) ? 'plain' : 'rich';
}

export function sourceBlocks(source: string, tables: boolean): MdBlock[] {
  return cached(`${tables ? 't' : 's'}${source}`, () => htmlBlocks(markdownToHtml(source.replace(SLOT_MARKS, ''), { tables })));
}

function spansText(spans: Span[]): string {
  return spans.map((span) => span.text).join('');
}

export function plainOf(blocks: MdBlock[]): string {
  const parts: string[] = [];
  const walk = (list: MdBlock[]) => {
    for (const block of list) {
      if (block.kind === 'text') parts.push(spansText(block.spans));
      else if (block.kind === 'list')
        block.items.forEach((item) => {
          parts.push(spansText(item.spans));
          walk(item.sub);
        });
      else if (block.kind === 'quote') walk(block.blocks);
      else if (block.kind === 'code') parts.push(block.text);
      else if (block.kind === 'table') [...(block.head ? [block.head] : []), ...block.rows].forEach((row) => row.forEach((cell) => parts.push(spansText(cell))));
    }
  };
  walk(blocks);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function editableSource(html: string): string {
  const composed = composedSource(parseTree(html));
  if (!composed) return plainOf(bodyBlocks(html));
  return composed.source.replace(/\uE000(\d+)\uE001/g, (_, index: string) => composed.slots[Number(index)]?.text ?? '').trim();
}

export function bodyPreview(html: string): string {
  return plainOf(bodyBlocks(html));
}
