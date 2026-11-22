import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [out, negative] = process.argv.slice(2);
if (!out || !negative) {
  console.error('usage: e2e-runner-trial-summary.mjs <output-dir> <negative-control flow name>');
  process.exit(2);
}

const INTERNAL_CLI_COMMANDS = new Set(['defineVariablesCommand', 'applyConfigurationCommand']);

function filesNamed(root, name) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return filesNamed(path, name);
    return entry === name ? [path] : [];
  });
}

function decode(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function junit(dir) {
  const path = join(dir, 'junit.xml');
  if (!existsSync(path)) return { flowSeconds: null, failure: null };
  const xml = readFileSync(path, 'utf8');
  const time = xml.match(/<testcase\b[^>]*\btime="([\d.]+)"/);
  const failure = xml.match(/<failure\b[^>]*>([\s\S]*?)<\/failure>/) ?? xml.match(/<failure\b[^>]*message="([^"]*)"/);
  return {
    flowSeconds: time ? Number(time[1]) : null,
    failure: failure ? decode(failure[1]).trim().split('\n')[0].slice(0, 200) : null,
  };
}

function cliSteps(dir) {
  const files = filesNamed(join(dir, 'raw'), 'commands.json');
  if (files.length === 0) return { steps: null, failedStep: null };
  let steps = 0;
  let failedStep = null;
  for (const file of files) {
    for (const entry of JSON.parse(readFileSync(file, 'utf8'))) {
      const type = Object.keys(entry.command ?? {})[0] ?? 'unknown';
      const status = entry.metadata?.status;
      if (INTERNAL_CLI_COMMANDS.has(type) || (status !== 'COMPLETED' && status !== 'FAILED')) continue;
      steps += 1;
      if (status === 'FAILED') failedStep = type.replace(/Command$/, '');
    }
  }
  return { steps, failedStep };
}

function runnerSteps(dir) {
  const [index] = filesNamed(join(dir, 'raw'), 'report.json');
  if (!index) return { steps: null, failedStep: null };
  const report = JSON.parse(readFileSync(index, 'utf8'));
  let steps = 0;
  let failedStep = null;
  const walk = (commands) => {
    for (const command of commands ?? []) {
      if (command.status === 'passed' || command.status === 'failed') steps += 1;
      if (command.status === 'failed') failedStep = command.type;
      walk(command.subCommands);
    }
  };
  for (const flow of report.flows ?? []) {
    const detail = join(dirname(index), flow.dataFile ?? '');
    if (flow.dataFile && existsSync(detail)) walk(JSON.parse(readFileSync(detail, 'utf8')).commands);
  }
  return { steps, failedStep };
}

function normalizedStep(step) {
  if (!step) return null;
  const name = step.replace(/Command$/, '');
  if (/^(assert|extendedWaitUntil)/.test(name)) return 'assert';
  if (/^(tapOn|longPressOn)/.test(name)) return 'tapOn';
  return name;
}

const lines = readFileSync(join(out, 'results.tsv'), 'utf8').trim().split('\n').slice(1);
const rows = lines.map((line) => {
  const [flow, runner, exit, wall, rss] = line.split('\t');
  const dir = join(out, flow, runner);
  const { flowSeconds, failure } = junit(dir);
  const { steps, failedStep } = runner === 'cli' ? cliSteps(dir) : runnerSteps(dir);
  return {
    flow,
    runner,
    passed: exit === '0',
    exit: Number(exit),
    wallSeconds: Number(wall),
    flowSeconds,
    steps,
    failedStep,
    failure,
    peakRssMb: Math.round(Number(rss) / 1024),
  };
});

const flows = [...new Set(rows.map((row) => row.flow))];
const comparisons = flows.map((flow) => {
  const cli = rows.find((row) => row.flow === flow && row.runner === 'cli');
  const runner = rows.find((row) => row.flow === flow && row.runner === 'runner');
  const mismatches = [];
  if (!cli || !runner) mismatches.push('missing run');
  else {
    if (cli.passed !== runner.passed) mismatches.push(`result: cli ${cli.passed ? 'passed' : 'failed'}, runner ${runner.passed ? 'passed' : 'failed'}`);
    if (!cli.passed && !runner.passed && normalizedStep(cli.failedStep) !== normalizedStep(runner.failedStep)) {
      mismatches.push(`failed step: cli ${cli.failedStep}, runner ${runner.failedStep}`);
    }
  }
  return { flow, expectedToFail: flow === negative, cli, runner, mismatches };
});

const total = (runner, key) => rows.filter((row) => row.runner === runner).reduce((sum, row) => sum + (row[key] ?? 0), 0);
const totals = {
  cli: { wallSeconds: total('cli', 'wallSeconds'), flowSeconds: total('cli', 'flowSeconds') },
  runner: { wallSeconds: total('runner', 'wallSeconds'), flowSeconds: total('runner', 'flowSeconds') },
};
const change = (key) => (totals.cli[key] ? Math.round((100 * (totals.runner[key] - totals.cli[key])) / totals.cli[key]) : null);
const negativeControl = comparisons.find((comparison) => comparison.expectedToFail);
const negativeHolds = Boolean(negativeControl?.cli && negativeControl?.runner && !negativeControl.cli.passed && !negativeControl.runner.passed);

writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ comparisons, totals, wallChangePercent: change('wallSeconds'), flowChangePercent: change('flowSeconds'), negativeHolds }, null, 2)}\n`);

const cell = (row) => (row ? `${row.passed ? 'pass' : 'fail'} | ${row.wallSeconds} | ${row.flowSeconds ?? '-'} | ${row.steps ?? '-'} | ${row.failedStep ?? '-'} | ${row.peakRssMb}` : '- | - | - | - | - | -');
const md = [
  '## Maestro CLI vs maestro-runner',
  '',
  '| flow | runner | result | wall s | flow s | steps | failed step | peak RSS MB |',
  '|---|---|---|---|---|---|---|---|',
  ...comparisons.flatMap(({ flow, cli, runner }) => [`| ${flow} | cli | ${cell(cli)} |`, `| ${flow} | runner | ${cell(runner)} |`]),
  '',
  `Total wall: cli ${totals.cli.wallSeconds.toFixed(1)} s, runner ${totals.runner.wallSeconds.toFixed(1)} s (${change('wallSeconds')}%). Total flow time: cli ${totals.cli.flowSeconds.toFixed(1)} s, runner ${totals.runner.flowSeconds.toFixed(1)} s (${change('flowSeconds')}%).`,
  `Negative control failed on both runners: ${negativeHolds ? 'yes' : 'NO'}.`,
  '',
  '### Mismatches',
  ...(comparisons.some((comparison) => comparison.mismatches.length)
    ? comparisons.filter((comparison) => comparison.mismatches.length).map(({ flow, mismatches }) => `- ${flow}: ${mismatches.join('; ')}`)
    : ['- none']),
  '',
  '### Failures',
  ...rows.filter((row) => row.failure).map((row) => `- ${row.flow} (${row.runner}): ${row.failure}`),
  '',
].join('\n');
writeFileSync(join(out, 'summary.md'), md);
console.log(md);
process.exit(negativeHolds ? 0 : 1);
