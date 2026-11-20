#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const usage = 'usage: perf-gate.mjs --out <metrics.json> <metric>=<value> [<metric>=<value>...]';

function fail(message) {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
if (!out) fail(usage);
const pairs = args.filter((_, index) => index !== outIndex && index !== outIndex + 1);
if (pairs.length === 0) fail(usage);

const measured = {};
for (const pair of pairs) {
  const [name, raw] = pair.split('=');
  const value = Number(raw);
  if (!name || !Number.isFinite(value) || value <= 0) fail(`bad metric "${pair}"; ${usage}`);
  measured[name] = value;
}

const baselinePath = new URL('../perf/baseline.json', import.meta.url);
const { metrics: baseline } = JSON.parse(readFileSync(baselinePath, 'utf8'));

const format = (value, unit) =>
  unit === 'bytes' ? `${(value / 1048576).toFixed(2)} MiB` : `${Math.round(value)} ${unit}`;

const rows = Object.entries(measured).map(([name, value]) => {
  const entry = baseline[name];
  if (!entry) return { name, value, ok: false, line: `| ${name} | ${value} | - | - | no baseline in perf/baseline.json |` };
  const change = value / entry.value - 1;
  const ok = change <= entry.maxIncrease;
  const verdict = ok ? 'ok' : `over the ${(entry.maxIncrease * 100).toFixed(0)}% limit`;
  const line = `| ${name} | ${format(value, entry.unit)} | ${format(entry.value, entry.unit)} | ${(change * 100).toFixed(1)}% | ${verdict} |`;
  return { name, value, ok, line };
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({ sha: process.env.SOURCE_SHA ?? null, metrics: measured }, null, 2)}\n`);

const table = ['| metric | measured | baseline | change | result |', '| --- | --- | --- | --- | --- |', ...rows.map((row) => row.line)].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Performance gate\n\n${table}\n\n`);

const failed = rows.filter((row) => !row.ok);
if (failed.length > 0) {
  console.error(`performance gate failed: ${failed.map((row) => row.name).join(', ')}. An intended change updates perf/baseline.json in the same pull request.`);
  process.exit(1);
}
