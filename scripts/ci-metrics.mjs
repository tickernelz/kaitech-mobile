#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const repo = process.env.GH_REPO ?? 'tickernelz/kaitech-mobile';
const args = process.argv.slice(2);

function api(path) {
  const out = execFileSync('gh', ['api', '--paginate', '--slurp', `repos/${repo}/${path}`], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  return JSON.parse(out);
}

const minutes = (from, to) => (Date.parse(to) - Date.parse(from)) / 60000;

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round = (value) => (value === null ? null : Math.round(value * 10) / 10);

function pullsToMeasure() {
  const at = args.indexOf('--merged');
  if (at === -1 && args.length > 0) return args.map(Number);
  const count = at === -1 ? 10 : Number(args[at + 1]);
  return api('pulls?state=closed&sort=updated&direction=desc&per_page=100')
    .flat()
    .filter((pull) => pull.merged_at)
    .sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at))
    .slice(0, count)
    .map((pull) => pull.number);
}

function measure(number) {
  const pull = api(`pulls/${number}`)[0];
  const end = pull.merged_at ?? new Date().toISOString();
  const runs = api(
    `actions/workflows/ci.yml/runs?event=pull_request&per_page=100&branch=${encodeURIComponent(pull.head.ref)}`,
  )
    .flatMap((page) => page.workflow_runs)
    .filter((run) => run.created_at >= pull.created_at && run.created_at <= end);
  const green = runs.filter((run) => run.conclusion === 'success');
  const jobMinutes = green.map((run) =>
    api(`actions/runs/${run.id}/jobs?per_page=100`)
      .flatMap((page) => page.jobs)
      .filter((job) => job.started_at && job.completed_at && job.conclusion !== 'skipped')
      .reduce((sum, job) => sum + minutes(job.started_at, job.completed_at), 0),
  );
  const cancelled = runs.filter((run) => run.conclusion === 'cancelled').length;
  return {
    pr: number,
    runs: runs.length,
    green: green.length,
    failed: runs.filter((run) => run.conclusion === 'failure').length,
    cancelled,
    cancelledPct: runs.length ? round((100 * cancelled) / runs.length) : null,
    jobMinutesPerGreenRun: round(median(jobMinutes)),
    greenWallMinutes: round(median(green.map((run) => minutes(run.run_started_at, run.updated_at)))),
    openToMergeMinutes: pull.merged_at ? round(minutes(pull.created_at, pull.merged_at)) : null,
  };
}

const rows = pullsToMeasure().map(measure);
console.table(rows);
const all = (key) => rows.map((row) => row[key]).filter((value) => value !== null);
const totalRuns = rows.reduce((sum, row) => sum + row.runs, 0);
const totalCancelled = rows.reduce((sum, row) => sum + row.cancelled, 0);
console.log(
  JSON.stringify(
    {
      pulls: rows.length,
      runs: totalRuns,
      medianJobMinutesPerGreenRun: round(median(all('jobMinutesPerGreenRun'))),
      medianGreenWallMinutes: round(median(all('greenWallMinutes'))),
      cancelledPctOfAllRuns: totalRuns ? round((100 * totalCancelled) / totalRuns) : null,
      medianCancelledPctPerPull: round(median(all('cancelledPct'))),
      medianOpenToMergeMinutes: round(median(all('openToMergeMinutes'))),
    },
    null,
    2,
  ),
);
