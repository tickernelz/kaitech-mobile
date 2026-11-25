import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/emoji-skin.mjs <unicode>/emoji/emoji-data.txt <unicode version>');
  process.exit(2);
}

const text = readFileSync(source, 'utf8');
const version = process.argv[3] ?? /^# Date: (\S+)/m.exec(text)?.[1] ?? 'unknown';
const ranges = [];
for (const line of text.split('\n')) {
  const match = /^([0-9A-F]{4,6})(?:\.\.([0-9A-F]{4,6}))?\s*;\s*Emoji_Modifier_Base\b/.exec(line);
  if (!match) continue;
  const start = parseInt(match[1], 16);
  const end = match[2] ? parseInt(match[2], 16) : start;
  const last = ranges.at(-1);
  if (last && last[1] + 1 === start) last[1] = end;
  else ranges.push([start, end]);
}
const notice = `/**\n * Emoji_Modifier_Base code points from Unicode emoji-data.txt ${version}.\n * Copyright (c) 1991-2023 Unicode, Inc. Distributed under the Terms of Use in https://www.unicode.org/copyright.html.\n */`;
const out = `${notice}\n\nexport const modifierBases: [number, number][] = [\n${ranges.map(([start, end]) => `  [0x${start.toString(16)}, 0x${end.toString(16)}],`).join('\n')}\n];\n`;
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'chat', 'emoji', 'skinData.ts');
writeFileSync(target, out);
console.log(target, ranges.length);
