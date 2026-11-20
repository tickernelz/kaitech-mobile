import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, size, orientation, language] = process.argv.slice(2);
if (!dir || !size || !['portrait', 'landscape'].includes(orientation) || !language) {
  console.error('usage: check-screenshots.mjs <dir> <size> <portrait|landscape> <language>');
  process.exit(2);
}

const suffix = `-${size}-${orientation}-${language}.png`;
const shots = readdirSync(dir).filter((name) => name.endsWith('.png'));
const failures = [];
if (shots.length === 0) failures.push(`no screenshots in ${dir}`);

for (const name of shots) {
  const png = readFileSync(join(dir, name));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const actual = width > height ? 'landscape' : 'portrait';
  console.log(`${name}: ${width}x${height} ${actual}`);
  if (!name.endsWith(suffix)) failures.push(`${name} is not named <screen>${suffix}`);
  if (actual !== orientation) failures.push(`${name} is ${width}x${height}, not ${orientation}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`::error::${failure}`);
  process.exit(1);
}
