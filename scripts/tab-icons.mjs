#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { glyphSvg } from './glyph-svg.mjs';

const root = join(import.meta.dirname, '..');
const out = join(root, 'assets', 'tabs');
const glyphs = { home: 'home', chat: 'chat', discovery: 'compass', mom: 'minutes', activity: 'bell' };
const point = 24;
const scales = [1, 2, 3];
const work = mkdtempSync(join(tmpdir(), 'tab-icons-'));

mkdirSync(out, { recursive: true });
for (const [tab, glyph] of Object.entries(glyphs)) {
  for (const variant of ['line', 'fill']) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${point}" height="${point}">${glyphSvg(glyph, variant, point, '#000000', 0, 0, 'm')}</svg>\n`;
    const source = join(work, `${tab}-${variant}.svg`);
    writeFileSync(source, svg);
    for (const scale of scales) {
      const file = join(out, `${tab}-${variant}${scale === 1 ? '' : `@${scale}x`}.png`);
      execFileSync('inkscape', [source, '--export-type=png', `--export-filename=${file}`, `--export-width=${point * scale}`, '--export-background-opacity=0'], { stdio: 'ignore' });
      console.log(file);
    }
  }
}
