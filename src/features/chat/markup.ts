export type Selection = { start: number; end: number };
export type Markup = 'bold' | 'italic' | 'code' | 'link' | 'quote' | 'list';
export type Edit = { text: string; selection: Selection };

export const markups: Markup[] = ['bold', 'italic', 'code', 'link', 'quote', 'list'];

const wraps = { bold: '**', italic: '_', code: '`' } as const;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d{1,9}[.)]) /;
const LINK_TARGET = /^(https?:\/\/|mailto:|tel:)\S+$/i;
const PLACEHOLDER = 'https://';

export function applyMarkup(text: string, selection: Selection, markup: Markup): Edit {
  const start = Math.max(0, Math.min(selection.start, selection.end, text.length));
  const end = Math.min(text.length, Math.max(selection.start, selection.end, start));
  if (markup === 'quote' || markup === 'list') return prefixLines(text, start, end, markup);
  if (markup === 'link') return link(text, start, end);
  if (markup === 'code' && text.slice(start, end).includes('\n')) return fence(text, start, end);
  return wrap(text, start, end, wraps[markup]);
}

function trimmed(text: string, start: number, end: number): [number, number] {
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from])) from += 1;
  while (to > from && /\s/.test(text[to - 1])) to -= 1;
  return from === to ? [start, end] : [from, to];
}

function wrap(text: string, start: number, end: number, mark: string): Edit {
  const [from, to] = start === end ? [start, end] : trimmed(text, start, end);
  const size = mark.length;
  const inner = text.slice(from, to);
  if (text.slice(from - size, from) === mark && text.slice(to, to + size) === mark && from - size >= 0) {
    return { text: text.slice(0, from - size) + inner + text.slice(to + size), selection: { start: from - size, end: to - size } };
  }
  if (inner.length >= size * 2 && inner.startsWith(mark) && inner.endsWith(mark)) {
    const bare = inner.slice(size, -size);
    return { text: text.slice(0, from) + bare + text.slice(to), selection: { start: from, end: from + bare.length } };
  }
  if (inner.includes('\n')) {
    const wrapped = inner
      .split('\n')
      .map((line) => {
        const content = line.trim();
        if (!content) return line;
        const lead = line.slice(0, line.indexOf(content));
        return `${lead}${mark}${content}${mark}`;
      })
      .join('\n');
    return { text: text.slice(0, from) + wrapped + text.slice(to), selection: { start: from, end: from + wrapped.length } };
  }
  return { text: text.slice(0, from) + mark + inner + mark + text.slice(to), selection: { start: from + size, end: to + size } };
}

function fence(text: string, start: number, end: number): Edit {
  const [from, to] = trimmed(text, start, end);
  const before = from > 0 && text[from - 1] !== '\n' ? '\n' : '';
  const after = to < text.length && text[to] !== '\n' ? '\n' : '';
  const block = `${before}\`\`\`\n${text.slice(from, to)}\n\`\`\`${after}`;
  const opening = before.length + 4;
  return { text: text.slice(0, from) + block + text.slice(to), selection: { start: from + opening, end: from + opening + (to - from) } };
}

function link(text: string, start: number, end: number): Edit {
  const [from, to] = trimmed(text, start, end);
  const label = text.slice(from, to);
  if (LINK_TARGET.test(label)) {
    const inserted = `[](${label})`;
    return { text: text.slice(0, from) + inserted + text.slice(to), selection: { start: from + 1, end: from + 1 } };
  }
  const inserted = `[${label}](${PLACEHOLDER})`;
  const target = from + label.length + 3;
  return {
    text: text.slice(0, from) + inserted + text.slice(to),
    selection: label ? { start: target, end: target + PLACEHOLDER.length } : { start: from + 1, end: from + 1 },
  };
}

function prefixLines(text: string, start: number, end: number, markup: 'quote' | 'list'): Edit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const found = text.indexOf('\n', last);
  const lineEnd = found < 0 ? text.length : found;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const marked = (line: string) => (markup === 'quote' ? /^\s*>/.test(line) : LIST_ITEM.test(line));
  const filled = lines.filter((line) => line.trim());
  const remove = filled.length > 0 && filled.every(marked);
  const next = lines.map((line) => {
    if (remove) return markup === 'quote' ? line.replace(/^(\s*)> ?/, '$1') : line.replace(LIST_ITEM, '$1');
    if (!line.trim()) return markup === 'quote' ? '>' : line;
    return markup === 'quote' ? `> ${line}` : `- ${line}`;
  });
  const block = next.join('\n');
  const replaced = text.slice(0, lineStart) + block + text.slice(lineEnd);
  if (start === end) {
    const shift = next[0].length - lines[0].length;
    const cursor = Math.max(lineStart, start + shift);
    return { text: replaced, selection: { start: cursor, end: cursor } };
  }
  return { text: replaced, selection: { start: lineStart, end: lineStart + block.length } };
}
