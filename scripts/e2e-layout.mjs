import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [out, size, orientation, language] = process.argv.slice(2);
if (!out || !size || !orientation || !language) {
  console.error('usage: e2e-layout.mjs <output-dir> <size> <orientation> <language>');
  process.exit(2);
}

const tabs = { chat: 'chat-list', discovery: 'tab-discovery', mom: 'tab-mom', activity: 'tab-activity' };
const barDp = { min: 56, max: 64 };
const contentGapDp = 24;
const pullDepthsDp = [16, 32, 48, 72, 96, 128];
const indicatorFromDp = 32;
const indicatorDepthsNeeded = 4;

const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function parse(xml) {
  const root = { children: [] };
  const stack = [root];
  for (const match of xml.matchAll(/<node ([^>]*?)(\/?)>|<\/node>/g)) {
    if (match[0] === '</node>') {
      stack.pop();
      continue;
    }
    const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((pair) => [pair[1], pair[2]]));
    const [left, top, right, bottom] = attrs.bounds.match(/-?\d+/g).map(Number);
    const node = { id: attrs['resource-id'], text: attrs.text, cls: attrs.class, pkg: attrs.package, clickable: attrs.clickable === 'true', left, top, right, bottom, children: [] };
    stack.at(-1).children.push(node);
    if (!match[2]) stack.push(node);
  }
  return root;
}

function* walk(node) {
  for (const child of node.children) {
    yield child;
    yield* walk(child);
  }
}

const find = (node, id) => [...walk(node)].find((one) => one.id === id);

function dump() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/kaitech-layout.xml');
      const xml = adb('shell', 'cat', '/sdcard/kaitech-layout.xml');
      if (xml.includes('io.kaitech.mobile')) return parse(xml);
    } catch {}
    sleep(1000);
  }
  throw new Error('uiautomator dump has no io.kaitech.mobile node');
}

function waitForNoCall() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (!find(dump(), 'incoming-decline')) return;
    sleep(1000);
  }
}

function screenshot(name) {
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 });
  writeFileSync(join(out, 'screenshots', `${name}-${size}-${orientation}-${language}.png`), png);
}

const densities = adb('shell', 'wm', 'density').match(/\d+/g).map(Number);
const scale = densities.at(-1) / 160;
const dp = (px) => Math.round((px / scale) * 10) / 10;
const statusBars = adb('shell', 'dumpsys', 'window', 'displays').match(/type=statusBars frame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/);
if (!statusBars) throw new Error('no statusBars inset in dumpsys window displays');
const statusBottom = Number(statusBars[4]);
const box = (node) => `[${node.left},${node.top}][${node.right},${node.bottom}]`;
const centerY = (node) => (node.top + node.bottom) / 2;

mkdirSync(join(out, 'screenshots'), { recursive: true });
const lines = [`density ${densities.at(-1)} (${scale}x), status bar bottom ${statusBottom}px`];
const failures = [];

for (const [tab, rootId] of Object.entries(tabs)) {
  waitForNoCall();
  const button = find(dump(), `tab-button-${tab}`);
  if (!button) {
    failures.push(`${tab}: no tab-button-${tab}`);
    continue;
  }
  adb('shell', 'input', 'tap', String((button.left + button.right) >> 1), String((button.top + button.bottom) >> 1));
  let screen;
  let root;
  for (let attempt = 0; attempt < 30 && !(root && find(root, 'app-bar')); attempt++) {
    sleep(attempt ? 1000 : 1500);
    screen = dump();
    root = find(screen, rootId);
  }
  const bar = root && find(screen, 'app-bar');
  if (!bar) {
    failures.push(`${tab}: ${root ? 'no app-bar' : `${rootId} never showed`}`);
    continue;
  }
  const inside = (node) => node.left >= root.left && node.right <= root.right && node.top >= root.top && node.bottom <= root.bottom;
  const title = find(screen, 'app-bar-title');
  const search = find(screen, 'open-search');
  const profile = find(screen, 'open-settings');
  const screenWidth = screen.children[0].right;
  lines.push(`${tab}: bar ${box(bar)} ${dp(bar.bottom - bar.top)}dp, title ${title ? box(title) : '-'} "${title?.text ?? ''}", search ${search ? box(search) : '-'}, profile ${profile ? box(profile) : '-'}`);
  if (!title || !title.text) failures.push(`${tab}: the bar shows no title`);
  if (!search || !profile) failures.push(`${tab}: the bar lacks Search or the profile`);
  for (const [name, node] of [['title', title], ['search', search], ['profile', profile]]) {
    if (node && (centerY(node) < bar.top || centerY(node) > bar.bottom)) failures.push(`${tab}: ${name} ${box(node)} is not in the bar row ${box(bar)}`);
  }
  if (title && search && title.right > search.left + 1) failures.push(`${tab}: title ${box(title)} runs into Search ${box(search)}`);
  const height = dp(bar.bottom - bar.top);
  if (height < barDp.min || height > barDp.max + 0.5) failures.push(`${tab}: bar is ${height}dp tall, not ${barDp.min}-${barDp.max}dp`);
  if (bar.top - statusBottom > 1) failures.push(`${tab}: ${dp(bar.top - statusBottom)}dp empty above the bar`);
  for (const [name, node] of [['search', search], ['profile', profile]].filter(([, node]) => node)) {
    if (Math.abs(node.right - node.left - (node.bottom - node.top)) > 2 || node.left < 0 || node.right > screenWidth) failures.push(`${tab}: ${name} ${box(node)} is cut off`);
  }
  const content = [...walk(screen)].filter((node) => inside(node) && node.top >= bar.bottom && node.bottom > node.top && (node.text || node.clickable)).sort((a, b) => a.top - b.top)[0];
  if (!content) failures.push(`${tab}: nothing under the bar`);
  else {
    const gap = dp(content.top - bar.bottom);
    lines.push(`${tab}: first content ${box(content)} "${content.text || content.id}", ${gap}dp under the bar`);
    if (gap > contentGapDp) failures.push(`${tab}: ${gap}dp empty between the bar and the first content`);
  }
  const twin = title?.text && [...walk(screen)].find((node) => inside(node) && node.top >= bar.bottom && node.text === title.text);
  if (twin) failures.push(`${tab}: a second title ${box(twin)} under the bar`);
  screenshot(`layout-${tab}`);

  const x = (bar.left + bar.right) >> 1;
  const indicator = (tree) => [...walk(tree)].find((node) => node.cls === 'android.widget.ImageView' && !node.id && Math.abs((node.left + node.right) / 2 - x) <= 8 * scale);
  for (let attempt = 0; attempt < 30; attempt++) {
    const spinning = indicator(screen);
    if (!spinning) break;
    if (attempt === 0) lines.push(`${tab}: refreshing on open, indicator ${box(spinning)}`);
    if (Math.abs(spinning.right - spinning.left - (spinning.bottom - spinning.top)) > 2 || spinning.top < bar.bottom) failures.push(`${tab}: the refreshing indicator ${box(spinning)} is clipped`);
    sleep(1000);
    screen = dump();
  }
  const y0 = bar.bottom + Math.round(40 * scale);
  adb('shell', 'input', 'motionevent', 'DOWN', String(x), String(y0));
  let seen = 0;
  for (const depth of pullDepthsDp) {
    adb('shell', 'input', 'motionevent', 'MOVE', String(x), String(y0 + Math.round(depth * scale)));
    sleep(300);
    const pulled = dump();
    const circle = indicator(pulled);
    if (!circle) {
      lines.push(`${tab}: pull ${depth}dp, no indicator`);
      continue;
    }
    if (depth >= indicatorFromDp) seen++;
    const width = circle.right - circle.left;
    const tall = circle.bottom - circle.top;
    lines.push(`${tab}: pull ${depth}dp, indicator ${box(circle)} ${dp(width)}x${dp(tall)}dp`);
    if (Math.abs(width - tall) > 2) failures.push(`${tab}: at ${depth}dp the indicator ${box(circle)} is clipped`);
    if (circle.top < bar.bottom) failures.push(`${tab}: at ${depth}dp the indicator ${box(circle)} reaches into the bar ${box(bar)}`);
    if (depth === pullDepthsDp.at(-1)) screenshot(`pull-${tab}`);
  }
  adb('shell', 'input', 'motionevent', 'MOVE', String(x), String(y0));
  adb('shell', 'input', 'motionevent', 'CANCEL', String(x), String(y0));
  const deep = pullDepthsDp.filter((depth) => depth >= indicatorFromDp).length;
  if (seen < indicatorDepthsNeeded) failures.push(`${tab}: the pull indicator showed at ${seen} of ${deep} depths from ${indicatorFromDp}dp; is the list at its top?`);
  sleep(1500);
}

lines.push(...failures.map((failure) => `FAIL ${failure}`));
writeFileSync(join(out, 'layout.txt'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
for (const failure of failures) console.error(`::error::${failure}`);
process.exit(failures.length ? 1 : 0);
