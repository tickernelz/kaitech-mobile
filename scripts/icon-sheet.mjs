#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { iconNames } from '../src/ui/icons/glyphs.ts';
import { glyphSvg as icon } from './glyph-svg.mjs';

const out = resolve(process.argv[2] ?? 'icon-sheet.png');
const sizes = [16, 20, 24, 32];
const schemes = [
  { name: 'light', canvas: '#FAF9FC', surface: '#FFFFFF', ink: '#11051B', soft: '#5C5466', accent: '#441D65' },
  { name: 'dark', canvas: '#110B18', surface: '#1B1323', ink: '#F0EDF4', soft: '#B5ADC1', accent: '#B18BD3' },
];
const columns = 9;
const cell = { w: 136, h: 104 };
const pad = 16;

function panel(scheme, top) {
  const rows = Math.ceil(iconNames.length / columns);
  const width = columns * cell.w + pad * 2;
  const height = rows * cell.h + pad * 2 + 28;
  let s = `<rect x="0" y="${top}" width="${width}" height="${height}" fill="${scheme.canvas}"/>`;
  s += `<text x="${pad}" y="${top + pad + 12}" font-family="sans-serif" font-size="14" font-weight="700" fill="${scheme.ink}">Kaitech lab0 icons · ${scheme.name} · 16 / 20 / 24 / 32 px · line (atas) dan fill (bawah)</text>`;
  iconNames.forEach((name, i) => {
    const cx = pad + (i % columns) * cell.w;
    const cy = top + pad + 28 + Math.floor(i / columns) * cell.h;
    s += `<rect x="${cx + 2}" y="${cy + 2}" width="${cell.w - 4}" height="${cell.h - 4}" rx="10" fill="${scheme.surface}"/>`;
    ['line', 'fill'].forEach((variant, row) => {
      let x = cx + 8;
      for (const size of sizes) {
        const y = cy + 8 + row * 38 + (32 - size) / 2;
        s += icon(name, variant, size, variant === 'fill' ? scheme.accent : scheme.ink, x, y, `m-${scheme.name}-${name}-${variant}-${size}`);
        x += size + 8;
      }
    });
    s += `<text x="${cx + 8}" y="${cy + cell.h - 10}" font-family="sans-serif" font-size="11" fill="${scheme.soft}">${name}</text>`;
  });
  return { svg: s, width, height };
}

const light = panel(schemes[0], 0);
const dark = panel(schemes[1], light.height);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${light.width}" height="${light.height + dark.height}">${light.svg}${dark.svg}</svg>`;
const dir = mkdtempSync(join(tmpdir(), 'icon-sheet-'));
const svgPath = join(dir, 'sheet.svg');
writeFileSync(svgPath, svg);
execFileSync('inkscape', [svgPath, '--export-type=png', `--export-filename=${out}`, '--export-dpi=192'], { stdio: 'ignore' });
console.log(out);
