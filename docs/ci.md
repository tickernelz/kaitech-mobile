# CI/CD

Everything runs on GitHub Actions standard runners: `ubuntu-latest` for Linux work and Android emulators, `macos-26` (pinned, newest Xcode 26) for iOS. `macos-15` cannot build the app: its newest Xcode is 26.3, and Expo SDK 58's `expo-modules-jsi` fails to compile there (`JavaScriptObject.swift:946: error: sending 'slot' risks causing data races`, run 45043443333). There are three workflows and no others.

| Workflow | Triggers | Purpose |
|---|---|---|
| `CI` (`.github/workflows/ci.yml`) | push to `main` (not docs-only), every pull request, manual | Fast merge gate, Linux only, no emulator |
| `E2E` (`.github/workflows/e2e.yml`) | push to `main`, pull request labelled `run-e2e`, nightly at 19:00 UTC (02:00 WIB), manual | Android emulator and iPad simulator flows |
| `Release` (`.github/workflows/release.yml`) | tag `v*`, manual | Release APKs and IPA, GitHub Release |

Composite actions in `.github/actions/` hold the shared steps: `build-android-apk` (build or repack, sign, verify, upload an APK), `android-e2e` (one emulator, Maestro flows, secret scan, upload), and the pinned, checksum-verified tool installers `setup-gitleaks`, `setup-maestro`, `setup-maestro-runner`, `setup-ccache`.

## CI: the merge gate

Jobs run in parallel and are the only required checks for merging into `main`:

| Check | Runs |
|---|---|
| `gitleaks diff` | gitleaks over the commits the change adds (`base..head` of the pull request, `before..after` of a push), not the whole history |
| `lint` | `npm run lint`, the tablet config gate (`scripts/check-tablet-config.mjs`) |
| `typecheck` | `npm run typecheck`, `maestro check-syntax` over every flow |
| `unit` | `npm run i18n:check` and `npm test -- --ci` (Jest) |

A new push to a pull request cancels its run in progress. Target: under 3 minutes wall time.

When a pull request closes, the `cache cleanup` job deletes the caches stored under its `refs/pull/<n>/merge` ref (pull requests from forks are skipped: their token cannot delete caches).

Docs-only changes (`docs/**`, `*.md`): pushes to `main` are skipped through `paths-ignore`. Pull requests are not filtered at the trigger, because a required check of a workflow that never starts stays "Expected" and blocks the merge. Instead the `changes` job lists the pull request files, and on a docs-only pull request `lint`, `typecheck` and `unit` report skipped, which branch protection accepts. `gitleaks diff` always runs, docs-only or not. The three gated jobs run unless `changes` explicitly answered docs-only (`!cancelled() && needs.changes.outputs.code != 'false'`): a failed `changes` job must not turn them into skipped checks, which branch protection would count as passed.

## E2E

The `plan` job picks a mode:

| Event | Mode |
|---|---|
| push to `main` (a merge) | smoke |
| pull request with the `run-e2e` label (labelling it, or pushing while it is labelled) | smoke |
| schedule, 19:00 UTC daily | full |
| manual (`workflow_dispatch`) | `mode` input, smoke by default |

Smoke: one Android emulator (`pixel_6`, portrait, `en-US`) runs `.maestro/welcome.yaml` and `.maestro/sign-in-form.yaml` with a screen recording, and measures cold start (perf gate `android.cold_start_ms`). It never uses the test account.

Full: four Android jobs (`pixel_6` and `pixel_tablet`, `en-US` and `id-ID`), each running portrait then landscape on the same emulator; four signed-in rows jobs (`.maestro/signed-in/rows-*.yaml`, phone and tablet, both locales; phone `en-US` runs with direct chats hidden); and the iPad simulator on `macos-26`. Full runs share the concurrency group `kaitech-e2e-account` with `queue: max` because the rows jobs sign in with the one test account: full runs never overlap, and a new one waits behind every pending one instead of replacing it. Pull request runs use `queue: single`, since GitHub rejects `queue: max` with `cancel-in-progress: true`.

Pull request runs of the same pull request cancel each other; labelling a pull request with another label does not cancel a running E2E run.

### Native fingerprint cache

`@expo/fingerprint` hashes everything that decides the native build: native dependencies and autolinking, config plugins, the resolved Expo config (so every value `app.config.ts` and `app.json` produce), `patches/`, and through `fingerprint.config.js` the whole of `modules/kaitech-call/` and `plugins/`. Code under `src/` is not part of it.

- Android: the `android apk x86_64` job restores the x86_64 release APK cached under `native-apk-x86_64-<signing>-<fingerprint>`. On a hit, `@expo/repack-app` (`--js-bundle-only`) puts this commit's Hermes bundle into it and signs it with the same key, skipping prebuild and Gradle. On a miss, the APK is built (Gradle cache, ccache) and saved under that key when the run is on `main`.
- iOS: the iPad job restores the simulator `Kaitech.app` cached under `ios-simulator-app-<fingerprint>` and repacks only the JS bundle on a hit. On a miss it runs `pod install` and `xcodebuild` and saves the app when the run is on `main`. Pods are not cached: the entry took 2,102 MB of the quota and only saves `pod install` (130-221 s) on a fingerprint change, next to 19-32 minutes of `xcodebuild`.

Release builds never use these caches: every release artifact is compiled from source. `release.yml` writes no cache at all: a release on a tag cannot read entries another tag wrote, and a release dispatched on `main` (run 45104485957) wrote 2,861 MB of Gradle, ccache and CocoaPods entries for its own jobs that nothing else restores.

### Emulator

`reactivecircus/android-emulator-runner`, API 35, `x86_64`, `google_apis`. Account-free phone jobs (smoke and the full phone cells) boot from an AVD snapshot cached as `avd-api35-x86_64-google_apis-pixel_6-v1` and never save it back (`-no-snapshot-save`). Full tablet cells boot a fresh, wiped emulator: the tablet snapshot took 3,545 MB of the 10 GB cache quota and saved no time (run 45069794592: restoring the phone snapshot took 52 s plus 12 s to boot, a cold tablet boot 39 s), and the signed-in rows tablet cells already pass on fresh boots. Only runs on `main` create the phone snapshot, after `cmd package bg-dexopt-job`, so a restored emulator does not resume post-boot work; a pull request that finds no snapshot cold-boots instead of creating one it cannot save (run 45056878705 attempt 1 restored a just-created snapshot at load average 8.9). `scripts/e2e-android.sh` also sets `hide_error_dialogs` and closes system dialogs before installing the app: on a busy fresh emulator "Pixel Launcher isn't responding" covered the app and both smoke flows timed out (run 45058782312 attempt 3, `cmd-001-hierarchy.xml`). Signed-in rows jobs and release install checks boot a fresh, wiped emulator without snapshots: rows need emulator audio for recording, and a snapshot taken without audio is not the device they were proven on (probe run 45043443333, rows phone en-US hide-direct, failed the first check of all three flows on a snapshot boot while the other three rows cells passed).

### Flow runner

`scripts/e2e-android.sh` picks the runner per orientation with `E2E_RUNNER=auto` (the default): [maestro-runner](https://github.com/devicelab-dev/maestro-runner) (Go binary, driver `devicelab`) when the screen is in its natural orientation (phone portrait, tablet landscape), Maestro CLI when the script rotated it (phone landscape, tablet portrait). maestro-runner 1.1.31 resizes the screen only after `setOrientation`, not after `cmd window user-rotation lock`, so every tap in a rotated cell failed with "element rect not tappable" (run 45039148320). Signed-in rows stay on Maestro CLI (`E2E_RUNNER_ROWS`, default `maestro`): in that run rows-discovery and rows-mom failed with maestro-runner on the phone. The iPad simulator and `maestro check-syntax` use Maestro CLI. The repository variables `E2E_RUNNER` (`auto`, `maestro`, `maestro-runner`) and `E2E_RUNNER_ROWS` switch runners without a pull request.

A/B on the same emulator (runs 45031368763, 45032009631, 45032023342, 45032703311): same results and failing steps with both runners, 44 to 58 percent shorter total time, 25 MB runner memory against 300 to 430 MB.

maestro-runner telemetry and update checks are off in every job (`MAESTRO_RUNNER_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`, `MAESTRO_RUNNER_NO_UPDATE_CHECK=1`, `open.devicelab.dev` resolved to `0.0.0.0`); `MAESTRO_RUNNER_TELEMETRY_DEBUG=1` prints any event that would have been built, and the script fails the cell when one is printed.

### Output

Every artifact is scanned by gitleaks before upload; nothing is uploaded when the scan fails. Smoke and full Android jobs upload `e2e-android-<mode>-<size>-<locale>` (one folder per orientation: video, `screenshots/`, `display.txt`, JUnit, logcat, `cold-start.txt`). Rows jobs upload `e2e-android-rows-*` without recordings, logs, or account values. The iPad job uploads `e2e-ipad-en-US`.

## Release

1. `gitleaks`: the ref must be a commit on `main`; gitleaks over the full git history and the working tree.
2. `android apk (universal)` (four ABIs) and `android apk (arm64-v8a)`, signed with the release keystore and checked against `.github/android-release-cert.sha256`, ABIs, bundled JS secrets, perf gate; `ios ipa (unsigned)` and `ios bundle secret scan`.
3. Tags only: draft GitHub Release with the APKs, IPA and `SHA256SUMS.txt`; the draft is downloaded again for checksums, rotation, multi-window and iPad config inside the files (`scripts/check-release-artifacts.py`), and gitleaks over the unpacked APK and IPA; the universal APK is installed on a fresh emulator in eight cells (phone and tablet, portrait and landscape, `en-US` and `id-ID`), and the four signed-in rows cells run on it too (`rows from release`, fresh emulator, one at a time in `kaitech-e2e-account`); the release is published only when both pass.

A manual run from `main` stops after step 2: it builds the release APKs and IPA as run artifacts (`kaitech-android-apk`, `kaitech-android-apk-arm64-v8a`, `kaitech-ios-ipa`) without creating a release. Use it for a build of `main` between releases.

To release: raise `version` in `app.json` through a pull request, then after the merge `git tag v<version> && git push origin v<version>` on that `main` commit.

## Caches

Written only from `refs/heads/main` (push, nightly schedule, dispatch on `main`) and read by every pull request, branch and tag. GitHub lets a run read caches of its own ref and of `main`, never of another branch, and evicts the least recently used entries once the repository passes its 10 GB quota; caches written by branches were never read by anyone else and pushed the `main` set out (ZHA-7494: 12,440 MB in 16 entries, none on `main`). Gradle runs with `cache-read-only` outside `main`. One full E2E set on `main` measured 7,726 MB with the pods entry (runs 45104004339 and 45104149712); without it 5,624 MB, under the 8 GB target with room for a second fingerprint while LRU evicts the first. The one exception is `setup-node`'s npm cache, which saves on a `package-lock.json` it has not seen; the `cache cleanup` job removes it when the pull request closes.

Every job that touches a cache writes a table to its run summary: each cache with `hit`, `partial` (an older entry through a restore prefix), `miss` or `not used`, its key, and whether the ref writes.

| Cache | Content | Key |
|---|---|---|
| `native-apk-<variant>-<signing>-<fingerprint>` | x86_64 E2E APK | native fingerprint |
| `ios-simulator-app-<fingerprint>` | iPad simulator app | native fingerprint |
| `avd-api35-x86_64-google_apis-pixel_6-v1` | phone AVD with a booted snapshot | profile |
| Gradle (`setup-gradle`) | dependencies, wrapper, Gradle build cache | managed by the action |
| `ccache-android-<variant>-…` | NDK C/C++ objects | `package-lock.json`, `app.json`, `app.config.ts` |

## Performance gate

`scripts/perf-gate.mjs` compares each run with `perf/baseline.json` and fails the job when a value rises past its `maxIncrease`. An intended change updates the baseline in the same pull request, with the reason in the description.

| Metric | Job |
|---|---|
| `android.apk_x86_64_bytes`, `android.js_bundle_bytes` | E2E `android apk x86_64` |
| `android.apk_universal_bytes`, `android.apk_arm64-v8a_bytes` | Release `android apk …` |
| `ios.ipa_bytes`, `ios.js_bundle_bytes` | Release `ios ipa (unsigned)` |
| `android.cold_start_ms` | E2E phone portrait `en-US` (median of 5 `am start -W -S`) |

## Secrets and variables

| Secret | Required | Use |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | for releases | non-store APK signing key |
| `GOOGLE_SERVICES_JSON` | no | FCM; without it the build stays green and Android push is off |
| `KAITECH_E2E_LOGIN`, `KAITECH_E2E_PASSWORD`, `KAITECH_E2E_WEB_LOGIN`, `KAITECH_E2E_WEB_PASSWORD` | for rows | test account, full E2E only |

Variables: `KAITECH_LINK_HOST`, `KAITECH_DEFAULT_DB` (build time), `KAITECH_E2E_CHANNEL_ID`, `KAITECH_E2E_PEER`, `KAITECH_E2E_PROGRAMME`, `KAITECH_E2E_SEARCH`, `E2E_RUNNER`, `E2E_RUNNER_ROWS`.

Secret values never reach the repository, logs, or artifacts. Pull requests from forks run without secrets and need the owner's approval before workflows run. Third-party actions are pinned to a commit SHA. The default workflow token is read-only.

## Repository settings

- Branch protection on `main`: required checks `gitleaks diff`, `lint`, `typecheck`, `unit` (all from `CI`), branches up to date before merging.
- Label `run-e2e`: `gh label create run-e2e --color 0E8A16 --description "Run the E2E smoke on this pull request"`.

## Local checks before a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run i18n:check
```

Changed workflows: `actionlint -ignore 'unexpected key "queue"'` (actionlint 1.7.12 does not know `concurrency.queue` yet). Changed flows: `maestro check-syntax <flow>`.
