const FENCE_LINE = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/;
const BLOCK_LANGUAGE = 'kt-block';

export type Segment = { kind: 'text'; text: string } | { kind: 'block'; raw: string };

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
