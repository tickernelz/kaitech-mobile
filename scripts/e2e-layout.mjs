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
const readableWidthDp = 720;

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
    const state = [...walk(screen)].find((node) => /-(loading|error|empty)$/.test(node.id) && node.top <= content.top && node.bottom >= content.bottom && node.left <= content.left && node.right >= content.right);
    lines.push(`${tab}: first content ${box(content)} "${content.text || content.id}", ${gap}dp under the bar${state ? `, inside the centred state view ${state.id}` : ''}`);
    if (gap > contentGapDp && !state) failures.push(`${tab}: ${gap}dp empty between the bar and the first content`);
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

async function rpc(path, params, cookie) {
  const answer = await fetch(`https://${process.env.E2E_SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
  });
  const body = await answer.json();
  if (!answer.ok || body.error) throw new Error(`${path} failed: ${answer.status} ${JSON.stringify(body.error ?? {}).slice(0, 200)}`);
  return { result: body.result, cookie: /session_id=([^;]+)/.exec(answer.headers.get('set-cookie') ?? '')?.[1] };
}

async function signIn(login, password) {
  const { cookie } = await rpc('/web/session/authenticate', { db: process.env.E2E_DB, login, password });
  if (!cookie) throw new Error(`no session cookie for ${login}`);
  return `session_id=${cookie}`;
}

async function checkBubbles(sent) {
  const missing = ['E2E_SERVER', 'E2E_DB', 'E2E_LOGIN', 'E2E_PASSWORD', 'E2E_WEB_LOGIN', 'E2E_WEB_PASSWORD', 'E2E_CHANNEL_ID'].filter((key) => !process.env[key]);
  if (missing.length) return failures.push(`bubbles: missing ${missing.join(', ')}`);
  const channel = Number(process.env.E2E_CHANNEL_ID);
  const stamp = `L${Date.now().toString(36)}`;
  const filler = 'the delivery for this order left the main warehouse this morning, please check it at receiving and report any shortfall or damaged packing';
  sent.push(
    { key: 'mine short', mine: true, long: false, body: `${stamp} ok` },
    { key: 'theirs short', mine: false, long: false, body: `${stamp} hi` },
    { key: 'mine long', mine: true, long: true, body: `${stamp} mine long, ${filler}` },
    { key: 'theirs long', mine: false, long: true, body: `${stamp} theirs long, ${filler}` },
  );
  const phone = await signIn(process.env.E2E_LOGIN, process.env.E2E_PASSWORD);
  const peer = await signIn(process.env.E2E_WEB_LOGIN, process.env.E2E_WEB_PASSWORD);
  for (const one of sent) {
    one.cookie = one.mine ? phone : peer;
    const post_data = { body: one.body, message_type: 'comment', subtype_xmlid: 'mail.mt_comment' };
    await rpc('/mail/message/post', { thread_model: 'discuss.channel', thread_id: channel, post_data }, one.cookie);
  }
  const found = (await rpc('/discuss/channel/messages', { channel_id: channel, fetch_params: { search_term: stamp, limit: 10 } }, phone)).result.data['mail.message'] ?? [];
  for (const one of sent) {
    const html = (row) => (Array.isArray(row.body) ? row.body[1] : String(row.body ?? ''));
    one.id = found.find((row) => html(row).includes(one.body))?.id;
    if (!one.id) return failures.push(`bubbles: "${one.body}" is not in channel ${channel}`);
  }

  waitForNoCall();
  const tab = find(dump(), 'tab-button-chat');
  if (!tab) return failures.push('bubbles: no tab-button-chat');
  adb('shell', 'input', 'tap', String((tab.left + tab.right) >> 1), String((tab.top + tab.bottom) >> 1));
  let row;
  for (let attempt = 0; attempt < 30 && !row; attempt++) {
    sleep(1000);
    row = find(dump(), `conversation-${channel}`);
  }
  if (!row) return failures.push(`bubbles: conversation-${channel} never showed in the chat list`);
  adb('shell', 'input', 'tap', String((row.left + row.right) >> 1), String((row.top + row.bottom) >> 1));
  let list;
  for (let attempt = 0; attempt < 30 && !list; attempt++) {
    sleep(1000);
    list = find(dump(), 'thread-list');
  }
  if (!list) return failures.push('bubbles: no thread-list');
  sleep(2000);
  const seen = new Map();
  for (let round = 0; round < 12 && seen.size < sent.length; round++) {
    const screen = dump();
    let found = false;
    for (const one of sent) {
      const node = find(screen, `bubble-${one.id}`);
      if (node && !seen.has(one.key) && node.top >= list.top && node.bottom <= list.bottom) {
        seen.set(one.key, node);
        found = true;
      }
    }
    if (found) screenshot('layout-bubbles');
    if (seen.size === sent.length) break;
    const x = String((list.left + list.right) >> 1);
    const [from, to] = round < 6 ? [0.7, 0.3] : [0.3, 0.7];
    adb('shell', 'input', 'swipe', x, String(Math.round(list.top + (list.bottom - list.top) * from)), x, String(Math.round(list.top + (list.bottom - list.top) * to)), '600');
    sleep(1200);
  }
  const absent = sent.filter((one) => !seen.has(one.key)).map((one) => one.key);
  if (absent.length) {
    screenshot('layout-bubbles-missing');
    return failures.push(`bubbles: no whole bubble for ${absent.join(', ')} after 6 screens towards the newest and 6 towards the oldest`);
  }
  const gutter = 16 * scale;
  const laneWidth = Math.min(list.right - list.left, (readableWidthDp + 32) * scale) - 2 * gutter;
  const laneLeft = (list.left + list.right - laneWidth) / 2;
  const laneRight = laneLeft + laneWidth;
  const cap = laneWidth * 0.8;
  lines.push(`bubbles: lane ${Math.round(laneLeft)}-${Math.round(laneRight)}px ${dp(laneWidth)}dp, cap ${dp(cap)}dp`);
  for (const one of sent) {
    const node = seen.get(one.key);
    const width = node.right - node.left;
    const gap = one.mine ? laneRight - node.right : node.left - laneLeft;
    lines.push(`bubbles: ${one.key} ${box(node)} ${dp(width)}dp, ${Math.round((width / laneWidth) * 100)}% of the lane, ${dp(gap)}dp from its side`);
    if (width > cap + 2) failures.push(`bubbles: ${one.key} is ${dp(width)}dp, wider than 80% of the lane (${dp(cap)}dp)`);
    if (Math.abs(gap) > 2) failures.push(`bubbles: ${one.key} sits ${dp(gap)}dp away from the ${one.mine ? 'right' : 'left'} side of the lane`);
    if (!one.long && width >= Math.min(cap - 16 * scale, laneWidth * 0.6)) failures.push(`bubbles: ${one.key} is ${dp(width)}dp, not sized to its text`);
    if (one.long && width < laneWidth * 0.6) failures.push(`bubbles: ${one.key} is ${dp(width)}dp, so the text did not wrap at the cap`);
  }
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  sleep(1500);
}

async function removeProbes(sent) {
  const removed = { unlink: 0, emptied: 0 };
  for (const one of sent.filter((probe) => probe.id)) {
    try {
      await rpc('/web/dataset/call_kw/mail.message/unlink', { model: 'mail.message', method: 'unlink', args: [[one.id]], kwargs: {} }, one.cookie);
      removed.unlink++;
    } catch {
      await rpc('/mail/message/update_content', { message_id: one.id, update_data: { body: '', attachment_ids: [], attachment_tokens: [] } }, one.cookie);
      removed.emptied++;
    }
  }
  lines.push(`bubbles: removed ${removed.unlink} probe messages, emptied ${removed.emptied} the author could not delete`);
}

const probes = [];
try {
  await checkBubbles(probes);
} catch (error) {
  const focus = adb('shell', 'dumpsys', 'window').match(/mCurrentFocus=\S+ \S+ (\S+)/)?.[1] ?? 'unknown';
  const running = adb('shell', 'pidof io.kaitech.mobile || true').trim() ? 'running' : 'not running';
  failures.push(`bubbles: ${error.message} (focus ${focus}, app ${running})`);
  screenshot('layout-bubbles-failed');
}
try {
  await removeProbes(probes);
} catch (error) {
  failures.push(`bubbles: probe messages ${probes.map((one) => one.id).join(', ')} were not removed: ${error.message}`);
}

function tapNode(node) {
  adb('shell', 'input', 'tap', String((node.left + node.right) >> 1), String((node.top + node.bottom) >> 1));
}

function waitFor(id, present = true) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const tree = dump();
    if (Boolean(find(tree, id)) === present) return tree;
    sleep(1000);
  }
  return null;
}

const shown = (node) => node && node.right - node.left > 1 && node.bottom - node.top > 1;

function composerParts(tree) {
  const parts = Object.fromEntries(['composer-row', 'composer-attach', 'composer-field', 'composer-panel-toggle', 'composer-camera', 'composer-send-slot'].map((id) => [id, find(tree, id)]));
  parts['composer-camera'] = shown(parts['composer-camera']) ? parts['composer-camera'] : undefined;
  return parts;
}

function checkComposer(state, parts) {
  const row = parts['composer-row'];
  const slot = parts['composer-send-slot'];
  if (!row || !slot) {
    failures.push(`composer ${state}: ${row ? 'no composer-send-slot' : 'no composer-row'}`);
    return null;
  }
  const order = ['composer-attach', 'composer-field', 'composer-camera', 'composer-send-slot'].map((id) => [id, parts[id]]).filter(([, node]) => node);
  lines.push(`composer ${state}: row ${box(row)} ${dp(row.bottom - row.top)}dp, ${order.map(([id, node]) => `${id.replace('composer-', '')} ${box(node)}`).join(', ')}`);
  for (let index = 1; index < order.length; index++) {
    const [leftId, left] = order[index - 1];
    const [rightId, right] = order[index];
    if (left.right > right.left + 1) failures.push(`composer ${state}: ${leftId} ${box(left)} overlaps ${rightId} ${box(right)}`);
  }
  for (const [id, node] of order.filter(([id]) => id !== 'composer-field')) {
    if (dp(node.right - node.left) < 43.5 || dp(node.bottom - node.top) < 43.5) failures.push(`composer ${state}: ${id} ${box(node)} is under 44dp`);
  }
  const toggle = parts['composer-panel-toggle'];
  const field = parts['composer-field'];
  if (toggle && field && (toggle.left < field.left || toggle.right > field.right + 1)) failures.push(`composer ${state}: the panel button ${box(toggle)} is outside the field ${box(field)}`);
  if (row.right > screenWidthAll + 1) failures.push(`composer ${state}: row ${box(row)} runs off the screen`);
  return { row, slot, camera: parts['composer-camera'] };
}

const peer = process.env.E2E_PEER;
const screenWidthAll = dump().children[0].right;
if (peer) {
  waitForNoCall();
  const chatButton = find(dump(), 'tab-button-chat');
  if (chatButton) tapNode(chatButton);
  let conversation;
  for (let attempt = 0; attempt < 30 && !conversation; attempt++) {
    sleep(1000);
    conversation = [...walk(dump())].find((node) => node.text === peer);
  }
  if (!conversation) failures.push(`composer: conversation "${peer}" never showed`);
  else {
    tapNode(conversation);
    const empty = waitFor('composer-row');
    const before = empty && checkComposer('empty', composerParts(empty));
    if (before && !before.camera) failures.push('composer empty: no camera button');
    screenshot('composer-empty');
    const input = empty && find(empty, 'composer-input');
    if (input) {
      tapNode(input);
      sleep(1500);
      adb('shell', 'input', 'text', 'hai');
      sleep(1200);
      const typed = checkComposer('typing', composerParts(dump()));
      screenshot('composer-typing');
      for (let key = 0; key < 3; key++) adb('shell', 'input', 'keyevent', 'KEYCODE_DEL');
      sleep(1200);
      const cleared = checkComposer('cleared', composerParts(dump()));
      if (typed?.camera) failures.push(`composer typing: the camera ${box(typed.camera)} still shows`);
      if (cleared && !cleared.camera) failures.push('composer cleared: the camera did not come back');
      for (const [state, now] of [['typing', typed], ['cleared', cleared]]) {
        if (!before || !now) continue;
        if (Math.abs(now.row.bottom - now.row.top - (before.row.bottom - before.row.top)) > 1) failures.push(`composer ${state}: row height ${dp(now.row.bottom - now.row.top)}dp, empty was ${dp(before.row.bottom - before.row.top)}dp`);
        if (Math.abs(now.slot.left - before.slot.left) > 1 || Math.abs(now.slot.right - before.slot.right) > 1) failures.push(`composer ${state}: the mic/send slot moved from ${box(before.slot)} to ${box(now.slot)}`);
      }
      const withKeyboard = find(dump(), 'composer-row');
      const toggle = withKeyboard && find(dump(), 'composer-panel-toggle');
      if (withKeyboard && toggle) {
        tapNode(toggle);
        sleep(1500);
        const panelTree = dump();
        const withPanel = find(panelTree, 'composer-row');
        const panel = find(panelTree, 'composer-panel');
        if (!panel) failures.push('composer panel: the panel did not open');
        if (withPanel) {
          const moved = dp(Math.abs(withPanel.top - withKeyboard.top));
          lines.push(`composer panel: row ${box(withPanel)} with the panel, ${box(withKeyboard)} with the keyboard, moved ${moved}dp`);
          if (moved > 1) failures.push(`composer panel: the row moved ${moved}dp when the panel replaced the keyboard`);
        }
        screenshot('composer-panel');
        const back = find(panelTree, 'composer-keyboard');
        if (back) {
          tapNode(back);
          sleep(1500);
          const again = find(dump(), 'composer-row');
          if (again) {
            const moved = dp(Math.abs(again.top - withKeyboard.top));
            lines.push(`composer panel: row ${box(again)} after the keyboard came back, moved ${moved}dp`);
            if (moved > 1) failures.push(`composer panel: the row moved ${moved}dp when the keyboard came back`);
          }
        } else failures.push('composer panel: no keyboard button while the panel is open');
      } else lines.push('composer panel: skipped, no keyboard-open row or panel button');
      adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
      sleep(1000);
    } else failures.push('composer: no composer-input');
  }
} else lines.push('composer: skipped, E2E_PEER is not set');

lines.push(...failures.map((failure) => `FAIL ${failure}`));
writeFileSync(join(out, 'layout.txt'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
for (const failure of failures) console.error(`::error::${failure}`);
process.exit(failures.length ? 1 : 0);
