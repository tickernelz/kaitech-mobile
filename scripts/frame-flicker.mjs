#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const usage = 'usage: frame-flicker.mjs <video.mp4> <left,top,right,bottom> [--out result.json] [--blank-frames dir] [--max-flicker N] [--max-blank N]';
const keptBlankFrames = 12;
const scale = 4;
const changed = 28;
const jumpAt = 0.01;
const settledAt = 0.003;
const windowMs = 350;
const slowShift = 16;
const bright = 225;
const blankShare = 0.25;

function fail(message) {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const [video, box] = args;
if (!video || !box) fail(usage);
const [left, top, right, bottom] = box.split(',').map(Number);
if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) fail(`bad box "${box}"; ${usage}`);
const out = option('--out');
const blankFrames = option('--blank-frames');
const limit = (name) => {
  const value = option(name);
  if (value === undefined) return Infinity;
  if (!/^\d+$/.test(value)) fail(`bad ${name} "${value}"; ${usage}`);
  return Number(value);
};
const maxFlicker = limit('--max-flicker');
const maxBlank = limit('--max-blank');
const shown = (value) => (value === Infinity ? 'no limit' : `limit ${value}`);

const times = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', video])
  .toString()
  .split(/\s+/)
  .filter(Boolean)
  .map(Number);
const width = Math.floor((right - left) / scale);
const height = Math.floor((bottom - top) / scale);
const raw = execFileSync(
  'ffmpeg',
  ['-v', 'quiet', '-i', video, '-fps_mode', 'passthrough', '-vf', `crop=${right - left}:${bottom - top}:${left}:${top},scale=${width}:${height}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
  { maxBuffer: 1 << 30 },
);
const size = width * height;
const count = Math.min(Math.floor(raw.length / size), times.length);
const frames = Array.from({ length: count }, (_, index) => raw.subarray(index * size, (index + 1) * size));
const rows = frames.map((frame) => {
  const means = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += frame[y * width + x];
    means[y] = sum / width;
  }
  return means;
});

function residual(a, b, dy) {
  const from = Math.max(0, -dy);
  const to = Math.min(height, height - dy);
  let differ = 0;
  for (let y = from; y < to; y++) {
    const ay = y * width;
    const by = (y + dy) * width;
    for (let x = 0; x < width; x++) if (Math.abs(frames[a][ay + x] - frames[b][by + x]) > changed) differ++;
  }
  return differ / ((to - from) * width);
}

function aligned(a, b) {
  const ra = rows[a];
  const rb = rows[b];
  const limit = Math.floor(height / 2);
  const scores = [];
  for (let dy = -limit; dy <= limit; dy++) {
    const from = Math.max(0, -dy);
    const to = Math.min(height, height - dy);
    let sum = 0;
    for (let y = from; y < to; y++) sum += Math.abs(ra[y] - rb[y + dy]);
    scores.push([sum / (to - from), dy]);
  }
  scores.sort((p, q) => p[0] - q[0]);
  let best = { dy: 0, residual: residual(a, b, 0) };
  for (const [, dy] of scores.slice(0, 4)) {
    const value = residual(a, b, dy);
    if (value < best.residual) best = { dy, residual: value };
  }
  return best;
}

const steps = [];
for (let index = 1; index < count; index++) steps.push(aligned(index - 1, index));

const flicker = [];
for (let index = 1; index < count - 1; index++) {
  const jump = steps[index - 1].residual;
  if (jump < jumpAt) continue;
  for (let later = index + 1; later < count && (times[later] - times[index]) * 1000 <= windowMs; later++) {
    if (Math.abs(steps[later - 1].dy) > slowShift || Math.abs(steps[index - 1].dy) > slowShift) break;
    if (aligned(index - 1, later).residual <= Math.min(settledAt, jump / 4)) {
      flicker.push({ frame: index, back: later, atMs: Math.round(times[index] * 1000), lastedMs: Math.round((times[later] - times[index]) * 1000), changed: Number(jump.toFixed(4)) });
      index = later;
      break;
    }
  }
}

function emptyShare(frame) {
  let run = 0;
  let longest = 0;
  for (let y = 0; y < height; y++) {
    let lit = 0;
    for (let x = 0; x < width && lit <= 2; x++) if (frame[y * width + x] > bright) lit++;
    run = lit > 2 ? 0 : run + 1;
    longest = Math.max(longest, run);
  }
  return longest / height;
}
const blankAt = frames.flatMap((frame, index) => {
  const share = emptyShare(frame);
  return share >= blankShare ? [{ frame: index, atMs: Math.round(times[index] * 1000), share: Number(share.toFixed(3)) }] : [];
});
const blank = blankAt.length;

const result = { video, box, frames: count, unexplained: steps.filter((step) => step.residual >= jumpAt).length, flicker: flicker.length, flickerAt: flicker, blank, blankAt };
if (out) writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
if (blankFrames && blank) {
  mkdirSync(blankFrames, { recursive: true });
  const name = basename(video, extname(video));
  for (const item of blankAt.slice(0, keptBlankFrames)) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `select=eq(n\\,${item.frame}),scale=iw/2:-2`, '-fps_mode', 'passthrough', '-frames:v', '1', join(blankFrames, `${name}-blank-${item.atMs}ms.png`)]);
  }
}
console.log(`${video}: ${count} frames, ${result.unexplained} frames changed beyond scrolling, ${flicker.length} flicker (${shown(maxFlicker)}), ${blank} frames with a quarter of the list empty (${shown(maxBlank)})`);
for (const item of flicker) console.log(`  flicker at ${item.atMs} ms for ${item.lastedMs} ms, ${(item.changed * 100).toFixed(1)}% of the list changed and came back`);
for (const item of blankAt) console.log(`  blank at ${item.atMs} ms (frame ${item.frame}), ${(item.share * 100).toFixed(0)}% of the list empty`);
if (flicker.length > maxFlicker || blank > maxBlank) process.exit(1);
