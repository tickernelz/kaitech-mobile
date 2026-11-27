#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const assetsDir = join(root, 'assets');
const brandDir = join(assetsDir, 'brand');
const appIconDir = join(assetsDir, 'AppIcon.icon');

const k =
  'M317.056 294.5C335.272 295.257 407.963 305.649 408.091 417.341V470.9C408.091 465.378 412.568 460.9 418.091 460.9H503.181V377.7H598.271V460.9H503.182V544.101H503.061C504.877 565.591 515.443 585.889 532.977 601.23C550.51 616.572 573.71 625.816 598.271 627.405V627.3H685.362C689.78 627.3 693.362 630.882 693.362 635.3V710.5H598.271V710.371C548.579 708.699 501.317 690.695 466.021 659.813C430.726 628.932 410.148 587.579 408.237 544.101H408.091V710.499C407.747 710.455 313.001 698.357 313.001 619.924L313 619.926V294.5H317.056ZM693.362 368.7C693.362 373.671 689.333 377.7 684.362 377.7H598.271V294.5H693.362V368.7Z';
const box = { x: 313, y: 294.5, w: 380.362, h: 416 };

const brand = '#441D65';
const ink = '#FFFFFF';

const iconMark = 0.48;
const adaptiveVisible = 288;
const notificationMark = 80 / 96;

function mark(size, height, color = ink) {
  const s = height / box.h;
  const tx = size / 2 - (box.x + box.w / 2) * s;
  const ty = size / 2 - (box.y + box.h / 2) * s;
  return `<g transform="translate(${tx} ${ty}) scale(${s})"><path d="${k}" fill="${color}"/></g>`;
}

function fill(size, color = brand) {
  return `<rect width="${size}" height="${size}" fill="${color}"/>`;
}

function svg(size, ...parts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts.join('')}</svg>\n`;
}

const assets = {
  'icon.png': { source: svg(1024, fill(1024), mark(1024, 1024 * iconMark)), opaque: true },
  'android-icon-background.png': { source: svg(432, fill(432)), opaque: true },
  'android-icon-foreground.png': { source: svg(432, mark(432, adaptiveVisible * iconMark)) },
  'android-icon-monochrome.png': { source: svg(432, mark(432, adaptiveVisible * iconMark)) },
  'splash-icon.png': { source: svg(1024, mark(1024, 1024)) },
  'notification-icon.png': { source: svg(96, mark(96, 96 * notificationMark)) },
};

const srgb = (hex) =>
  `srgb:${[1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5)).join(',')},1.00000`;

const iconComposer = {
  fill: { solid: srgb(brand) },
  'fill-specializations': [{ appearance: 'dark', value: 'system-dark' }],
  groups: [
    {
      layers: [{ 'image-name': 'mark.svg', name: 'mark', glass: true }],
      shadow: { kind: 'neutral', opacity: 0.5 },
      translucency: { enabled: true, value: 0.5 },
    },
  ],
  'supported-platforms': { squares: 'shared' },
};

rmSync(brandDir, { recursive: true, force: true });
mkdirSync(brandDir, { recursive: true });
for (const [png, { source, opaque }] of Object.entries(assets)) {
  const svgPath = join(brandDir, png.replace(/\.png$/, '.svg'));
  writeFileSync(svgPath, source);
  execFileSync(
    'inkscape',
    [
      svgPath,
      '--export-type=png',
      `--export-filename=${join(assetsDir, png)}`,
      `--export-png-color-mode=${opaque ? 'RGB_8' : 'RGBA_8'}`,
    ],
    { stdio: 'ignore' },
  );
}

rmSync(appIconDir, { recursive: true, force: true });
mkdirSync(join(appIconDir, 'Assets'), { recursive: true });
writeFileSync(join(appIconDir, 'Assets', 'mark.svg'), svg(1024, mark(1024, 1024 * iconMark)));
writeFileSync(join(appIconDir, 'icon.json'), `${JSON.stringify(iconComposer, null, 2)}\n`);
