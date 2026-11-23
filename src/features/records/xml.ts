export type XmlNode = { tag: string; attrs: Record<string, string>; children: (XmlNode | string)[] };

const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

export function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, code: string) => {
    if (code[0] === '#') {
      const point = code[1] === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    }
    return named[code] ?? whole;
  });
}

const attrPattern = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

function attrsOf(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(attrPattern)) attrs[match[1]] = unescapeXml(match[3] ?? match[4] ?? '');
  return attrs;
}

export function parseXml(source: string): XmlNode {
  const root: XmlNode = { tag: '#root', attrs: {}, children: [] };
  const stack: XmlNode[] = [root];
  let at = 0;
  while (at < source.length) {
    const open = source.indexOf('<', at);
    const textEnd = open === -1 ? source.length : open;
    if (textEnd > at) {
      const text = unescapeXml(source.slice(at, textEnd));
      if (text.trim()) stack[stack.length - 1].children.push(text);
    }
    if (open === -1) break;
    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open + 4);
      at = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', open)) {
      const end = source.indexOf(']]>', open + 9);
      const text = source.slice(open + 9, end === -1 ? source.length : end);
      if (text.trim()) stack[stack.length - 1].children.push(text);
      at = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source[open + 1] === '?' || source[open + 1] === '!') {
      const end = source.indexOf('>', open);
      at = end === -1 ? source.length : end + 1;
      continue;
    }
    const close = findTagEnd(source, open);
    const body = source.slice(open + 1, close);
    at = close + 1;
    if (body[0] === '/') {
      const tag = body.slice(1).trim();
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].tag === tag) {
          stack.length = depth;
          break;
        }
      }
      continue;
    }
    const selfClosing = body.endsWith('/');
    const inner = selfClosing ? body.slice(0, -1) : body;
    const space = inner.search(/\s/);
    const tag = space === -1 ? inner : inner.slice(0, space);
    const node: XmlNode = { tag, attrs: space === -1 ? {} : attrsOf(inner.slice(space)), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  const first = root.children.find((child): child is XmlNode => typeof child !== 'string');
  return first ?? root;
}

function findTagEnd(source: string, from: number): number {
  let quote = '';
  for (let at = from + 1; at < source.length; at += 1) {
    const char = source[at];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return at;
  }
  return source.length;
}

export function elements(node: XmlNode): XmlNode[] {
  return node.children.filter((child): child is XmlNode => typeof child !== 'string');
}

export function textOf(node: XmlNode): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : textOf(child)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
