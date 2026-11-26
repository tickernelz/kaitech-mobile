import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { inflateSync } from 'node:zlib';

const shareColor = [0x44, 0x1d, 0x65];
const tolerance = 40;
const minShare = 0.02;

function decode(png) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const depth = png[24];
  const type = png[25];
  const interlace = png[28];
  const channels = { 2: 3, 6: 4 }[type];
  if (depth !== 8 || !channels || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
  const chunks = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const kind = png.toString('ascii', offset + 4, offset + 8);
    if (kind === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    if (kind === 'IEND') break;
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[x] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

function shareFraction({ width, height, channels, pixels }) {
  let hits = 0;
  for (let at = 0; at < width * height * channels; at += channels) {
    if (shareColor.every((value, index) => Math.abs(pixels[at + index] - value) <= tolerance)) hits++;
  }
  return hits / (width * height);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: check-screen-share.mjs <screenshot.png>...');
  process.exit(2);
}
let failed = false;
for (const file of files) {
  const fraction = shareFraction(decode(readFileSync(file)));
  console.log(`${basename(file)}: ${(fraction * 100).toFixed(1)}% of the screen shows the peer's shared screen`);
  if (fraction < minShare) {
    console.error(`::error::${basename(file)} does not show the peer's shared screen (${(fraction * 100).toFixed(2)}% < ${minShare * 100}%)`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
