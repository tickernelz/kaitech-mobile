import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/emoji-data.mjs <odoo>/addons/web/static/src/core/emoji_picker/emoji_data.js');
  process.exit(2);
}

const text = readFileSync(source, 'utf8');
const notice = text.slice(text.indexOf('/**'), text.indexOf('*/') + 2);
const body = text.replace(/^import .*$/m, 'const appTranslateFn = (value) => value;').replace(/^export /gm, '');
const { getEmojis, getCategories } = new Function(`${body}\nreturn { getEmojis, getCategories };`)();

const keys = {
  'Smileys & Emotion': 'smileys',
  'People & Body': 'people',
  'Animals & Nature': 'nature',
  'Food & Drink': 'food',
  'Travel & Places': 'travel',
  Activities: 'activities',
  Objects: 'objects',
  Symbols: 'symbols',
  Flags: 'flags',
};

const groups = new Map();
for (const category of getCategories().sort((a, b) => a.sortId - b.sortId)) groups.set(category.name, []);
for (const emoji of getEmojis()) {
  const list = groups.get(emoji.category);
  if (!list) continue;
  const words = new Set();
  for (const value of [emoji.name, ...emoji.keywords, ...emoji.shortcodes.map((code) => code.replace(/:/g, '').replace(/_/g, ' '))]) {
    for (const word of value.toLowerCase().split(/[\s,]+/)) if (word) words.add(word);
  }
  list.push(`${emoji.codepoints}\t${[...words].join(' ')}`);
}

const entries = [...groups].filter(([name]) => keys[name]).map(([name, list]) => `  [${JSON.stringify(keys[name])}, ${JSON.stringify(list.join('\n'))}],`);
const out = `${notice}\n\nexport type EmojiCategory = ${Object.values(keys).filter((key) => entries.some((entry) => entry.includes(`"${key}"`))).map((key) => JSON.stringify(key)).join(' | ')};\n\nexport const emojiData: [EmojiCategory, string][] = [\n${entries.join('\n')}\n];\n`;
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'chat', 'emoji', 'data.ts');
writeFileSync(target, out);
console.log(target, out.length);
