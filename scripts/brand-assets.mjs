#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const brandDir = join(root, 'assets', 'brand');
const k = 'M143.15 433L60.55 324.5V433H0.700001V187.3H60.55V295.1L142.45 187.3H212.8L117.6 307.7L216.3 433H143.15Z';
const box = { x: 0.7, y: 187.3, w: 359.3, h: 245.7 };

function mark({ size, width, ink, bar, cx = size / 2, cy = size / 2 }) {
  const s = width / box.w;
  const tx = cx - (box.x + box.w / 2) * s;
  const ty = cy - (box.y + box.h / 2) * s;
  const fill = Array.isArray(bar) ? 'url(#bar)' : bar;
  const gradient = Array.isArray(bar)
    ? `<linearGradient id="bar" x1="236" y1="433" x2="360" y2="390" gradientUnits="userSpaceOnUse"><stop stop-color="${bar[0]}"/><stop offset="1" stop-color="${bar[1]}"/></linearGradient>`
    : '';
  return {
    defs: gradient,
    body: `<g transform="translate(${tx} ${ty}) scale(${s})"><path d="${k}" fill="${ink}"/><rect x="236" y="390" width="124" height="43" fill="${fill}"/></g>`,
  };
}

function background(size, from, to) {
  return {
    defs: `<linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`,
    body: `<rect width="${size}" height="${size}" fill="url(#bg)"/>`,
  };
}

function svg(size, parts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${parts.map((p) => p.defs).join('')}</defs>${parts.map((p) => p.body).join('')}</svg>\n`;
}

const light = { from: '#5A2A85', to: '#2E1146', ink: '#FFFFFF', bar: ['#C9A6EE', '#FF5A5A'] };
const dark = { from: '#1E1429', to: '#0D0812', ink: '#F0EDF4', bar: ['#B18BD3', '#FF5A5A'] };

const assets = {
  'icon.png': svg(1024, [background(1024, light.from, light.to), mark({ size: 1024, width: 560, ink: light.ink, bar: light.bar })]),
  'icon-dark.png': svg(1024, [background(1024, dark.from, dark.to), mark({ size: 1024, width: 560, ink: dark.ink, bar: dark.bar })]),
  'icon-tinted.png': svg(1024, [background(1024, '#000000', '#000000'), mark({ size: 1024, width: 560, ink: '#FFFFFF', bar: '#BDBDBD' })]),
  'android-icon-background.png': svg(432, [background(432, light.from, light.to)]),
  'android-icon-foreground.png': svg(432, [mark({ size: 432, width: 220, ink: light.ink, bar: light.bar })]),
  'android-icon-monochrome.png': svg(432, [mark({ size: 432, width: 220, ink: '#FFFFFF', bar: '#FFFFFF' })]),
  'splash-icon.png': svg(1024, [mark({ size: 1024, width: 520, ink: '#200C30', bar: ['#441D65', '#FF5A5A'] })]),
  'splash-icon-dark.png': svg(1024, [mark({ size: 1024, width: 520, ink: '#F0EDF4', bar: ['#B18BD3', '#FF5A5A'] })]),
  'notification-icon.png': svg(96, [mark({ size: 96, width: 80, ink: '#FFFFFF', bar: '#FFFFFF' })]),
  'favicon.png': svg(1024, [background(1024, light.from, light.to), mark({ size: 1024, width: 600, ink: light.ink, bar: light.bar })]),
};

const sizes = { 'favicon.png': 48 };

mkdirSync(brandDir, { recursive: true });
for (const [png, source] of Object.entries(assets)) {
  const svgPath = join(brandDir, png.replace(/\.png$/, '.svg'));
  writeFileSync(svgPath, source);
  const size = sizes[png] ?? Number(/width="(\d+)"/.exec(source)[1]);
  execFileSync('inkscape', [svgPath, '--export-type=png', `--export-filename=${join(root, 'assets', png)}`, `--export-width=${size}`], {
    stdio: 'ignore',
  });
}
