#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const usage =
  'usage: phone-jank.mjs --thread <channelId> [--scenario record-cancel|attach|record-lock] [--apk name=path ...] [--rounds 3] [--repeat 5] [--serial S] [--out result.json] [--max-janky 5] [--max-p90 11.1]';
const pkg = 'io.kaitech.mobile';
const settleMs = 1500;

function fail(message) {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const many = (name) => args.flatMap((value, index) => (args[index - 1] === name ? [value] : []));
const number = (name, fallback) => {
  const raw = option(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`bad ${name} "${raw}"; ${usage}`);
  return value;
};

const thread = option('--thread');
if (!thread || !/^\d+$/.test(thread)) fail(usage);
const scenarioNames = option('--scenario', 'record-cancel').split(',');
const rounds = number('--rounds', 1);
const repeat = number('--repeat', 5);
const serial = option('--serial', process.env.ANDROID_SERIAL);
const out = option('--out');
const maxJanky = number('--max-janky', Infinity);
const maxP90 = number('--max-p90', Infinity);
const apks = many('--apk').map((pair) => {
  const at = pair.indexOf('=');
  if (at < 1) fail(`bad --apk "${pair}"; ${usage}`);
  return { name: pair.slice(0, at), path: pair.slice(at + 1) };
});

const adb = (...rest) => execFileSync('adb', [...(serial ? ['-s', serial] : []), ...rest], { encoding: 'utf8', maxBuffer: 64 << 20 });
const shell = (command) => adb('shell', command);
const sleep = (ms) => execFileSync('sleep', [String(ms / 1000)]);

function foreground() {
  const line = shell('dumpsys activity activities').split('\n').find((entry) => entry.includes('topResumedActivity'));
  return line?.includes(pkg) ?? false;
}

function nodes() {
  let said = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    shell('rm -f /sdcard/phone-jank.xml');
    said = shell('uiautomator dump /sdcard/phone-jank.xml 2>&1; true').trim();
    const xml = shell('cat /sdcard/phone-jank.xml 2>/dev/null; true');
    if (xml.includes(pkg)) {
      const found = new Map();
      for (const match of xml.matchAll(/resource-id="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
        const [, id, left, top, right, bottom] = match;
        if (!found.has(id)) found.set(id, { x: Math.round((+left + +right) / 2), y: Math.round((+top + +bottom) / 2), left: +left, top: +top, right: +right, bottom: +bottom });
      }
      return found;
    }
    sleep(1000);
  }
  fail(`uiautomator dump never showed the app: ${said}`);
}

function centre(id) {
  const point = nodes().get(id);
  if (!point) fail(`${id} is not on screen`);
  return point;
}

function openThread() {
  if (!foreground()) fail(`${pkg} is not in front; stop before touching the phone`);
  for (let step = 0; step < 4; step += 1) {
    const found = nodes();
    if (found.has(`thread-${thread}`)) return;
    const row = found.get(`conversation-${thread}`);
    if (row) shell(`input tap ${row.x} ${row.y}`);
    else if (found.has('thread-back')) shell(`input tap ${found.get('thread-back').x} ${found.get('thread-back').y}`);
    else break;
    sleep(settleMs);
  }
  fail(`thread ${thread} not open; on screen: ${[...nodes().keys()].slice(0, 20).join(' ')}`);
}

function gestureZones() {
  return [...shell('dumpsys window').matchAll(/type=systemGestures frame=\[(\d+),(\d+)\]\[(\d+),(\d+)\]/g)].map(([, left, top, right, bottom]) => ({ left: +left, top: +top, right: +right, bottom: +bottom }));
}

export function pressPoint(box, zones) {
  const inside = (x) => zones.some((zone) => x >= zone.left && x < zone.right && box.y >= zone.top && box.y < zone.bottom);
  for (let x = box.x; x > box.left; x -= 1) if (!inside(x)) return { x, y: box.y };
  return null;
}

function pressable(id) {
  const box = centre(id);
  const point = pressPoint(box, gestureZones());
  if (!point) fail(`${id} lies entirely inside a system gesture zone`);
  return point;
}

const scenarios = {
  'record-cancel': () => {
    const mic = pressable('composer-mic');
    return () => {
      const moves = Array.from({ length: 24 }, (_, index) => `input motionevent MOVE ${mic.x - (index + 1) * 16} ${mic.y}; sleep 0.04`).join('; ');
      shell(`input motionevent DOWN ${mic.x} ${mic.y}; sleep 1.2; ${moves}; sleep 0.3; input motionevent UP ${mic.x - 384} ${mic.y}`);
      sleep(settleMs);
      if (!nodes().has(`thread-${thread}`)) fail('the thread closed during record-cancel; a system gesture took the touch');
    };
  },
  attach: () => {
    const attach = pressable('composer-attach');
    return () => {
      shell(`input tap ${attach.x} ${attach.y}`);
      sleep(settleMs);
      shell('input keyevent 4');
      sleep(settleMs);
    };
  },
  'record-lock': () => {
    const mic = pressable('composer-mic');
    return () => {
      shell(`input swipe ${mic.x} ${mic.y} ${mic.x} ${Math.max(10, mic.y - 360)} 900`);
      sleep(2000);
      for (const id of ['voice-pause', 'voice-draft-play', 'voice-draft-play', 'voice-discard']) {
        const point = nodes().get(id);
        if (!point) fail(`${id} is not on screen`);
        shell(`input tap ${point.x} ${point.y}`);
        sleep(settleMs);
      }
    };
  },
};
for (const name of scenarioNames) if (!scenarios[name]) fail(`unknown scenario "${name}"; ${usage}`);

export function parseGfxinfo(text) {
  const read = (pattern) => {
    const match = text.match(pattern);
    return match ? Number(match[1]) : null;
  };
  const frames = read(/Total frames rendered: (\d+)/);
  if (!frames) return null;
  return {
    frames,
    janky: read(/Janky frames: \d+ \(([\d.]+)%\)/),
    jankyLegacy: read(/Janky frames \(legacy\): \d+ \(([\d.]+)%\)/),
    p50: read(/^50th percentile: (\d+)ms/m),
    p90: read(/^90th percentile: (\d+)ms/m),
    p99: read(/^99th percentile: (\d+)ms/m),
    gpuP50: read(/50th gpu percentile: (\d+)ms/),
    gpuP90: read(/90th gpu percentile: (\d+)ms/),
    gpuP99: read(/99th gpu percentile: (\d+)ms/),
  };
}

function measure(scenario) {
  openThread();
  const step = scenarios[scenario]();
  step();
  shell(`dumpsys gfxinfo ${pkg} reset >/dev/null`);
  for (let index = 0; index < repeat; index += 1) step();
  const stats = parseGfxinfo(shell(`dumpsys gfxinfo ${pkg}`));
  if (!stats) fail('gfxinfo recorded no frames');
  return stats;
}

function install(apk) {
  const device = serial ? `-s ${serial}` : '';
  const script = [
    `adb ${device} install -r "$1" >/dev/null & installer=$!`,
    'for _ in $(seq 1 40); do',
    '  kill -0 $installer 2>/dev/null || break',
    `  adb ${device} shell uiautomator dump /sdcard/phone-jank.xml >/dev/null 2>&1`,
    `  box=$(adb ${device} shell cat /sdcard/phone-jank.xml | grep -oE 'text="Jangan kirim"[^>]*bounds="\\[[0-9]+,[0-9]+\\]\\[[0-9]+,[0-9]+\\]"' | grep -oE '[0-9]+' | tail -4 | tr '\\n' ' ')`,
    `  [ -n "$box" ] && set -- "$1" $box && adb ${device} shell input tap $(( ($2 + $4) / 2 )) $(( ($3 + $5) / 2 ))`,
    '  sleep 3',
    'done',
    'wait $installer',
  ].join('\n');
  execFileSync('bash', ['-c', script, 'install', apk.path], { stdio: 'inherit' });
  shell(`am start -W -n ${pkg}/.MainActivity >/dev/null`);
  sleep(3000);
}

const builds = apks.length ? apks : [{ name: 'installed', path: null }];
const runs = [];
for (let round = 0; round < rounds; round += 1) {
  const order = round % 2 === 0 ? builds : [...builds].reverse();
  for (const build of order) {
    if (build.path) install(build);
    for (const scenario of scenarioNames) {
      runs.push({ round: round + 1, build: build.name, scenario, ...measure(scenario) });
      console.log(JSON.stringify(runs.at(-1)));
    }
  }
}

const mean = (values) => Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
const summary = builds.flatMap(({ name }) =>
  scenarioNames.map((scenario) => {
    const mine = runs.filter((run) => run.build === name && run.scenario === scenario);
    return { build: name, scenario, runs: mine.length, janky: mean(mine.map((run) => run.janky)), p90: mean(mine.map((run) => run.p90)), p99: mean(mine.map((run) => run.p99)), gpuP90: mean(mine.map((run) => run.gpuP90)) };
  }),
);
for (const row of summary) console.log(`${row.build} ${row.scenario}: janky ${row.janky}% p90 ${row.p90} ms p99 ${row.p99} ms gpu p90 ${row.gpuP90} ms (${row.runs} runs)`);
if (out) writeFileSync(out, JSON.stringify({ scenarios: scenarioNames, repeat, runs, summary }, null, 2));
const over = summary.filter((row) => row.janky > maxJanky || row.p90 > maxP90);
if (over.length) {
  console.error(`over the limit (janky <= ${maxJanky}%, p90 <= ${maxP90} ms): ${over.map((row) => `${row.build} ${row.scenario}`).join(', ')}`);
  process.exit(1);
}
