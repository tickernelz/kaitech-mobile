export type Span = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
  mention?: { model: string; id: number };
};

export type Block = { quote: boolean; item: boolean; spans: Span[] };

const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', '#39': "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*|#39);/gi, (whole, name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('#x')) return codePoint(parseInt(lower.slice(2), 16), whole);
    if (lower.startsWith('#')) return codePoint(parseInt(lower.slice(1), 10), whole);
    return named[lower] ?? whole;
  });
}

function codePoint(value: number, fallback: string): string {
  return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : fallback;
}

function attribute(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  if (!match) return null;
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
}

const blockTags = new Set(['p', 'div', 'li', 'blockquote', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'table', 'tr']);
const hiddenTags = new Set(['script', 'style', 'head', 'title']);

type Style = Omit<Span, 'text'>;

export function parseBody(html: string): Block[] {
  const blocks: Block[] = [];
  let current: Block = { quote: false, item: false, spans: [] };
  const stack: { tag: string; style: Style }[] = [];
  let quoteDepth = 0;
  let hidden = 0;

  const style = (): Style => stack.reduce<Style>((acc, entry) => ({ ...acc, ...entry.style }), {});
  const flush = () => {
    const spans = trimSpans(current.spans);
    if (spans.length) blocks.push({ ...current, spans });
    current = { quote: quoteDepth > 0, item: false, spans: [] };
  };
  const push = (text: string) => {
    if (!text) return;
    const spanStyle = style();
    const last = current.spans[current.spans.length - 1];
    if (last && sameStyle(last, spanStyle)) last.text += text;
    else current.spans.push({ text, ...spanStyle });
  };

  const pattern = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|</g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const [whole, closing, rawTag, attrs, text] = match;
    if (text !== undefined || whole === '<') {
      if (!hidden) push(decodeEntities(text ?? whole).replace(/[\t\r\n ]+/g, ' '));
      continue;
    }
    if (!rawTag) continue;
    const tag = rawTag.toLowerCase();
    if (hiddenTags.has(tag)) {
      hidden += closing ? -1 : 1;
      hidden = Math.max(hidden, 0);
      continue;
    }
    if (tag === 'br') {
      push('\n');
      continue;
    }
    if (blockTags.has(tag)) {
      flush();
      if (tag === 'blockquote') quoteDepth = Math.max(0, quoteDepth + (closing ? -1 : 1));
      current.quote = quoteDepth > 0;
      if (!closing && tag === 'li') current.item = true;
      continue;
    }
    if (closing) {
      const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (index >= 0) stack.splice(index);
      continue;
    }
    if (/\/\s*$/.test(attrs)) continue;
    stack.push({ tag, style: styleFor(tag, attrs) });
  }
  flush();
  return blocks;
}

function styleFor(tag: string, attrs: string): Style {
  if (tag === 'b' || tag === 'strong') return { bold: true };
  if (tag === 'i' || tag === 'em') return { italic: true };
  if (tag === 'code') return { code: true };
  if (tag !== 'a') return {};
  const model = attribute(attrs, 'data-oe-model');
  const id = Number(attribute(attrs, 'data-oe-id'));
  if (model && Number.isInteger(id) && id > 0) return { mention: { model, id } };
  const href = attribute(attrs, 'href');
  return href && /^(https?:|mailto:|tel:)/i.test(href) ? { href } : {};
}

function sameStyle(span: Span, style: Style): boolean {
  return (
    !!span.bold === !!style.bold &&
    !!span.italic === !!style.italic &&
    !!span.code === !!style.code &&
    span.href === style.href &&
    span.mention?.model === style.mention?.model &&
    span.mention?.id === style.mention?.id
  );
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

export function plainText(html: string): string {
  return parseBody(html)
    .map((block) => block.spans.map((span) => span.text).join(''))
    .join('\n');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const urlPattern = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

function linkify(escaped: string): string {
  return escaped.replace(urlPattern, (url) => `<a href="${url}" target="_blank" rel="noreferrer noopener">${url}</a>`);
}

export type ComposedMention = { id: number; name: string };

export function mentionLink(mention: ComposedMention): string {
  return `<a href="/odoo/res.partner/${mention.id}" class="o_mail_redirect" data-oe-id="${mention.id}" data-oe-model="res.partner" target="_blank" contenteditable="false">@${escapeHtml(mention.name)}</a>`;
}

export function mentionsInText<T extends ComposedMention>(text: string, mentions: T[]): T[] {
  const seen = new Set<number>();
  return mentions.filter((mention) => {
    if (seen.has(mention.id) || !text.includes(`@${mention.name}`)) return false;
    seen.add(mention.id);
    return true;
  });
}

export function composeBody(text: string, mentions: ComposedMention[]): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const used = mentionsInText(trimmed, mentions).sort((a, b) => b.name.length - a.name.length);
  const pieces: { text: string; mention?: ComposedMention }[] = [{ text: trimmed }];
  for (const mention of used) {
    const needle = `@${mention.name}`;
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (piece.mention || !piece.text.includes(needle)) continue;
      const parts = piece.text.split(needle);
      const replaced: typeof pieces = [];
      parts.forEach((part, index) => {
        if (index > 0) replaced.push({ text: needle, mention });
        if (part) replaced.push({ text: part });
      });
      pieces.splice(i, 1, ...replaced);
      i += replaced.length - 1;
    }
  }
  return pieces
    .map((piece) => (piece.mention ? mentionLink(piece.mention) : linkify(escapeHtml(piece.text))))
    .join('')
    .replace(/\r?\n/g, '<br>');
}
