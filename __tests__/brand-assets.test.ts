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
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? data[y * stride + x - channels] : 0;
      const up = y > 0 ? data[(y - 1) * stride + x] : 0;
      const corner = y > 0 && x >= channels ? data[(y - 1) * stride + x - channels] : 0;
      const p = left + up - corner;
      const nearest =
        Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - corner)
          ? left
          : Math.abs(p - up) <= Math.abs(p - corner)
            ? up
            : corner;
      const predictor = [0, left, up, (left + up) >> 1, nearest][filter];
      data[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  return { width, height, channels, data };
}

function pixels(png: Png) {
  const out: { x: number; y: number; rgb: string; alpha: number }[] = [];
  for (let i = 0; i < png.width * png.height; i++) {
    const at = i * png.channels;
    const rgb = Array.from(png.data.subarray(at, at + 3), (v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    out.push({ x: i % png.width, y: Math.floor(i / png.width), rgb: `#${rgb}`, alpha: png.channels === 4 ? png.data[at + 3] : 255 });
  }
  return out;
}

const brand = seedColor.toUpperCase();
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const plugin = (name: string) => app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === name)[1];

describe('brand assets', () => {
  it('fills the whole iOS and store icon square with the brand colour and carries no alpha', () => {
    const icon = readPng(asset('icon.png'));
    expect([icon.width, icon.height, icon.channels]).toEqual([1024, 1024, 3]);
    const all = pixels(icon);
    for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023], [512, 8]]) {
      expect(all[y * 1024 + x].rgb).toBe(brand);
    }
    expect(new Set(all.map((p) => p.rgb)).has('#FFFFFF')).toBe(true);
  });

  it('keeps every visible pixel of the adaptive foreground and monochrome layers inside the 66 dp safe circle', () => {
    for (const name of ['android-icon-foreground.png', 'android-icon-monochrome.png']) {
      const layer = readPng(asset(name));
      expect([layer.width, layer.height, layer.channels]).toEqual([432, 432, 4]);
      const visible = pixels(layer).filter((p) => p.alpha > 0);
      expect(visible.length).toBeGreaterThan(0);
      const reach = Math.max(...visible.map((p) => Math.hypot(p.x + 0.5 - 216, p.y + 0.5 - 216)));
      expect(reach).toBeLessThanOrEqual((432 * 66) / 108 / 2);
      expect(visible.every((p) => p.rgb === '#FFFFFF')).toBe(true);
    }
  });

  it('paints the adaptive background flat in the brand colour', () => {
    const background = readPng(asset('android-icon-background.png'));
    expect([background.width, background.height]).toEqual([432, 432]);
    expect(new Set(pixels(background).map((p) => `${p.rgb}/${p.alpha}`))).toEqual(new Set([`${brand}/255`]));
  });

  it('draws the notification and splash marks in white on transparent', () => {
    for (const [name, size] of [['notification-icon.png', 96], ['splash-icon.png', 1024]] as const) {
      const png = readPng(asset(name));
      expect([png.width, png.height, png.channels]).toEqual([size, size, 4]);
      const all = pixels(png);
      expect(all[0].alpha).toBe(0);
      expect(all.filter((p) => p.alpha > 0).every((p) => p.rgb === '#FFFFFF')).toBe(true);
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
