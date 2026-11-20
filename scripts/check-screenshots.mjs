import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, size, orientation, language] = process.argv.slice(2);
if (!dir || !size || !['portrait', 'landscape'].includes(orientation) || !language) {
  console.error('usage: check-screenshots.mjs <dir> <size> <portrait|landscape> <language>');
  process.exit(2);
}

function exifOrientation(png) {
  for (let offset = 8; offset + 8 <= png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'eXIf') {
      const tiff = png.subarray(offset + 8, offset + 8 + length);
      const little = tiff.toString('ascii', 0, 2) === 'II';
      const u16 = (at) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
      const u32 = (at) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
      const ifd = u32(4);
      for (let entry = 0; entry < u16(ifd); entry++) {
        const at = ifd + 2 + entry * 12;
        if (u16(at) === 0x0112) return u16(at + 8);
      }
      return 1;
    }
    if (type === 'IDAT') return 1;
    offset += 12 + length;
  }
  return 1;
}

const suffix = `-${size}-${orientation}-${language}.png`;
const shots = readdirSync(dir).filter((name) => name.endsWith('.png'));
const failures = [];
if (shots.length === 0) failures.push(`no screenshots in ${dir}`);

for (const name of shots) {
  const png = readFileSync(join(dir, name));
  const stored = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const orientationTag = exifOrientation(png);
  const [width, height] = orientationTag >= 5 ? stored.reverse() : stored;
  const actual = width > height ? 'landscape' : 'portrait';
  console.log(`${name}: ${width}x${height} ${actual}${orientationTag === 1 ? '' : ` (EXIF orientation ${orientationTag})`}`);
  if (!name.endsWith(suffix)) failures.push(`${name} is not named <screen>${suffix}`);
  if (actual !== orientation) failures.push(`${name} is ${width}x${height}, not ${orientation}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`::error::${failure}`);
  process.exit(1);
}
