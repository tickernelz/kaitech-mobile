# Pull requests and CI

CI runners are the bottleneck of this repository: one full CI run takes about 110 to 120 runner minutes (12 to 13 Android emulator jobs, an iOS build on `xcode-27`, an x86_64 APK, lint and unit tests). Every rule below keeps that capacity for runs that can merge, without skipping a check on code that ships.

## What runs when

The `CI` workflow (`.github/workflows/ci.yml`) runs on pushes to `main`, on pull requests, and by hand. `build` calls `.github/workflows/build.yml`, which `Release` also calls for tags.

| Event | gitleaks, lint, typecheck, unit | e2e matrix, iOS IPA, x86_64 APK |
|---|---|---|
| Draft pull request | yes | no: the `build` job is skipped |
| Pull request marked ready (`ready_for_review`), and every push after | yes | yes, unless the PR changes only docs |
| Ready pull request that changes only `docs/**` or `README.md` | yes | no: the jobs inside `build` report skipped |
| Push to `main`, tag, manual run | yes | yes |

A new push to a pull request cancels the run still in progress for it.

### Draft pull requests

A draft skips the whole `build` job, so the required checks named `build / ...` are never reported for that SHA and stay "Expected". A draft therefore cannot satisfy branch protection even if it were marked ready without a new run. Marking it ready starts a full run on the same SHA, and merging needs that run green.

### Docs-only pull requests

The `changes` job lists the files the pull request changes (`git diff --no-renames --name-only <base>...<head>`). When every path is under `docs/` or is the root `README.md`, `build` runs with `docs_only: true` and its app jobs report skipped, which branch protection counts as passed. Any other path, including `.github/`, `AGENTS.md`, `package.json`, `app.json`, `src/` and `.maestro/`, runs the full matrix. Pushes to `main` and tags always run it.

If the `changes` job fails, `build` does not run and the `build / ...` checks stay "Expected", so the pull request cannot merge.

## Required checks

`main` requires the branch to be up to date with `main` (strict) and these checks green on the final SHA: `gitleaks`, `lint, typecheck, unit`, `build / android apk`, `build / ios ipa (unsigned)`, `build / ios bundle secret scan`, `build / e2e android en-US`, `build / e2e android id-ID`. `build / android apk` (the universal release APK) is skipped on pull requests and runs on `main` and tags.

## Working on a pull request

1. Open the pull request as a draft.
2. Push once per step, after the local checks below pass. Never push an intermediate commit only to see CI: each push cancels the run in progress and queues 110 runner minutes behind every other pull request.
3. Keep at most two ready pull requests per author; the rest stay drafts.
4. Mark the pull request ready when the work is complete. Request review when CI is green on the final SHA, not when the pull request opens, so the review and the merge cover the same SHA.
5. A finding from review is fixed in one push, and review continues on that SHA once its CI is green.

### Local checks before every push

Run them at low priority; they need no emulator:

```bash
nice -n 19 npm run lint
nice -n 19 npm run typecheck
nice -n 19 npx jest --ci --maxWorkers=2 --findRelatedTests <changed files>
```

Changed Maestro flows: `maestro check-syntax <flow>`. Changed workflows: `actionlint`.

## Merge order

With strict branch protection every merge makes the other pull requests out of date, and updating one from `main` restarts its CI. To spend one full run per pull request:

1. Merge the pull requests that are already green and approved first, oldest first.
2. Update a pull request from `main` once, when it is next in line, green and approved. An update that merges cleanly keeps the review; one with conflicts gets a review of the resolved hunks.
3. Merge when that run is green. Do not update the rest of the queue in advance.

## Measuring

`scripts/ci-metrics.mjs` measures, per merged pull request: CI runs, failed and cancelled runs, job minutes per green run, wall minutes per green run, and minutes from opening to merge.

```bash
node scripts/ci-metrics.mjs --merged 10
node scripts/ci-metrics.mjs 40 41 42 45
```

Changes to the matrix itself (fewer emulator boots, fewer rows cells, path filters, moving iOS) are proposed with these numbers and their effect on coverage first.

Probe for ZHA-7475: a pull request that changes only this file.
