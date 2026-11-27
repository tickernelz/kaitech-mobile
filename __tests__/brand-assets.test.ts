import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { seedColor } from '../src/theme/materialSeed';

type Png = { width: number; height: number; channels: number; data: Uint8Array };

const root = join(__dirname, '..');
const asset = (name: string) => join(root, 'assets', name);

function readPng(path: string): Png {
  const file = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error(`${path}: only 8-bit non-interlaced PNGs are read`);
      channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[body[9]] ?? 0;
      if (!channels) throw new Error(`${path}: colour type ${body[9]} is not read`);
    }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    const above = row - stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? data[row + x - channels] : 0;
      const up = y > 0 ? data[above + x] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const corner = y > 0 && x >= channels ? data[above + x - channels] : 0;
        const p = left + up - corner;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - corner);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      }
      data[row + x] = (line[x] + predictor) & 0xff;
    }
  }
  return { width, height, channels, data };
}

function alphaAt(png: Png, at: number) {
  return png.channels === 4 ? png.data[at + 3] : 255;
}

const brand = seedColor.toUpperCase();
const brandRgb = parseInt(brand.slice(1), 16);
const brandR = (brandRgb >> 16) & 0xff;
const brandG = (brandRgb >> 8) & 0xff;
const brandB = brandRgb & 0xff;
const safeRadius = (432 * 66) / 108 / 2;
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const plugin = (name: string) => app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === name)[1];

describe('brand assets', () => {
  it('fills the whole iOS and store icon square with the brand colour and carries no alpha', () => {
    const icon = readPng(asset('icon.png'));
    expect([icon.width, icon.height, icon.channels]).toEqual([1024, 1024, 3]);
    for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023], [512, 8]]) {
      const at = (y * icon.width + x) * icon.channels;
      expect([icon.data[at], icon.data[at + 1], icon.data[at + 2]]).toEqual([brandR, brandG, brandB]);
    }
    let white = 0;
    for (let at = 0; at < icon.data.length; at += icon.channels) {
      if (icon.data[at] === 255 && icon.data[at + 1] === 255 && icon.data[at + 2] === 255) white++;
    }
    expect(white).toBeGreaterThan(0);
  });

  it('keeps every visible pixel of the adaptive foreground and monochrome layers inside the 66 dp safe circle', () => {
    for (const name of ['android-icon-foreground.png', 'android-icon-monochrome.png']) {
      const layer = readPng(asset(name));
      expect([layer.width, layer.height, layer.channels]).toEqual([432, 432, 4]);
      let visible = 0;
      let reach = 0;
      let tinted = 0;
      for (let y = 0; y < layer.height; y++) {
        for (let x = 0; x < layer.width; x++) {
          const at = (y * layer.width + x) * layer.channels;
          if (!layer.data[at + 3]) continue;
          visible++;
          reach = Math.max(reach, Math.hypot(x + 0.5 - layer.width / 2, y + 0.5 - layer.height / 2));
          if (layer.data[at] !== 255 || layer.data[at + 1] !== 255 || layer.data[at + 2] !== 255) tinted++;
        }
      }
      expect(visible).toBeGreaterThan(0);
      expect(reach).toBeLessThanOrEqual(safeRadius);
      expect(tinted).toBe(0);
    }
  });

  it('paints the adaptive background flat in the brand colour', () => {
    const background = readPng(asset('android-icon-background.png'));
    expect([background.width, background.height]).toEqual([432, 432]);
    let off = 0;
    for (let at = 0; at < background.data.length; at += background.channels) {
      if (background.data[at] !== brandR || background.data[at + 1] !== brandG || background.data[at + 2] !== brandB) off++;
      if (alphaAt(background, at) !== 255) off++;
    }
    expect(off).toBe(0);
  });

  it('draws the notification and splash marks in white on transparent', () => {
    for (const [name, size] of [['notification-icon.png', 96], ['splash-icon.png', 1024]] as const) {
      const png = readPng(asset(name));
      expect([png.width, png.height, png.channels]).toEqual([size, size, 4]);
      expect(alphaAt(png, 0)).toBe(0);
      let visible = 0;
      let tinted = 0;
      for (let at = 0; at < png.data.length; at += png.channels) {
        if (!png.data[at + 3]) continue;
        visible++;
        if (png.data[at] !== 255 || png.data[at + 1] !== 255 || png.data[at + 2] !== 255) tinted++;
      }
      expect(visible).toBeGreaterThan(0);
      expect(tinted).toBe(0);
    }
  });

  it('wires the generated files into the app config with the brand colour', () => {
    expect(app.ios.icon).toBe('./assets/AppIcon.icon');
    const composer = JSON.parse(readFileSync(asset('AppIcon.icon/icon.json'), 'utf8'));
    const [r, g, b] = composer.fill.solid.replace('srgb:', '').split(',').map((v: string) => Math.round(Number(v) * 255));
    expect(`#${[r, g, b].map((v: number) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()).toBe(brand);
    for (const group of composer.groups) {
      for (const layer of group.layers) expect(existsSync(asset(`AppIcon.icon/Assets/${layer['image-name']}`))).toBe(true);
    }
    expect(app.android.adaptiveIcon.backgroundColor.toUpperCase()).toBe(brand);
    const splash = plugin('expo-splash-screen');
    expect(splash.backgroundColor.toUpperCase()).toBe(brand);
    expect(splash.dark).toBeUndefined();
    expect(plugin('expo-notifications').color.toUpperCase()).toBe(brand);
    for (const path of [app.icon, splash.image, plugin('expo-notifications').icon, ...Object.values(app.android.adaptiveIcon)]) {
      if (typeof path === 'string' && path.startsWith('./')) expect(existsSync(join(root, path))).toBe(true);
    }
  });
});
