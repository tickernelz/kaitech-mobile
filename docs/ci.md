# CI/CD

Everything runs on GitHub Actions standard runners: `ubuntu-latest` for Linux work and Android emulators, `macos-26` (pinned, newest Xcode 26) for iOS. `macos-15` cannot build the app: its newest Xcode is 26.3, and Expo SDK 58's `expo-modules-jsi` fails to compile there (`JavaScriptObject.swift:946: error: sending 'slot' risks causing data races`, run 45043443333). There are three workflows and no others.

| Workflow | Triggers | Purpose |
|---|---|---|
| `CI` (`.github/workflows/ci.yml`) | push to `main` (not docs-only), every pull request, manual | Fast merge gate, Linux only, no emulator |
| `E2E` (`.github/workflows/e2e.yml`) | push to `main`, pull request labelled `run-e2e`, nightly at 19:00 UTC (02:00 WIB), manual | Android emulator and iPhone simulator flows |
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
| manual (`workflow_dispatch`) | `mode` input (`smoke`, `android`, `full`), smoke by default |

Smoke: one Android emulator (`pixel_6`, portrait, `en-US`) runs `.maestro/welcome.yaml` and `.maestro/sign-in-form.yaml` with a screen recording, and measures cold start (perf gate `android.cold_start_ms`). It never uses the test account.

Full: four Android jobs (`pixel_6` and `pixel_tablet`, `en-US` and `id-ID`), each running portrait then landscape on the same emulator; four signed-in rows jobs (`.maestro/signed-in/rows-*.yaml`, phone and tablet, both locales; phone `en-US` runs with direct chats hidden), which then photograph the main screens in the light and the dark system theme (`.maestro/themed/tour.yaml`) and keep the frame statistics of a Chat list scroll (`.maestro/themed/scroll.yaml`, `scroll-gfxinfo.txt`); four signed-in MoM jobs (`.maestro/signed-in/mom-*.yaml`, phone and tablet, both locales) that start after the rows jobs of the run and take the same `kaitech-e2e-account-<size>-<locale>` group; and the iPhone simulator on `macos-26` (newest available iPhone, portrait then landscape, `DEVICE_SIZE=phone`). Tablet layouts are tested on the Android tablet cells; iPad layouts are not tested in CI since ZHA-7503 (the iPad simulator job took 32 to 71 minutes and held every run behind it), only the iPad configuration inside the IPA (`scripts/check-release-artifacts.py`) and the tablet config gate.

Android: the full run without the iOS simulator. It is the proof for a feature branch before review (about 26 minutes, run 45095995935: APK 14 minutes, then the eight Android cells in 12). The iPad job alone took 32 to 71 minutes on a cold simulator build (runs 45069794592, 45070632107), so branch proof no longer waits for it; the nightly schedule and dispatches on `main` run `full` and carry the iOS proof.

The lock sits on the jobs that need it, not on the run. Each rows and MoM job takes the group `kaitech-e2e-account-<size>-<locale>` with `queue: max`: the four rows cells of one run still run side by side, as they always did, while the same cell never runs twice at once across runs, so the test account never carries more than the four distinct cells one full run already puts on it. `rows from release` takes the same groups. The Android matrix and the iOS job never sign in (`scripts/e2e-ios.sh` runs only `.maestro/welcome.yaml` and `.maestro/sign-in-form.yaml`, without account values), so they hold no account group: the iOS job queues on its own group `kaitech-e2e-ios`, and a run's Android jobs never wait for another run's iOS job. A job that adds `E2E_LOGIN` must take a `kaitech-e2e-account-*` group. Android and full runs get a group of their own per run at workflow level. Pull request runs use `queue: single`, since GitHub rejects `queue: max` with `cancel-in-progress: true`.

Pull request runs of the same pull request cancel each other; labelling a pull request with another label does not cancel a running E2E run.

### Native fingerprint cache

`@expo/fingerprint` hashes everything that decides the native build: native dependencies and autolinking, config plugins, the resolved Expo config (so every value `app.config.ts` and `app.json` produce), `patches/`, and through `fingerprint.config.js` the whole of `modules/kaitech-call/` and `plugins/`. Code under `src/` is not part of it.

- Android: the `android apk x86_64` job restores the x86_64 release APK cached under `native-apk-x86_64-<signing>-<fingerprint>`. On a hit, `@expo/repack-app` (`--js-bundle-only`) puts this commit's Hermes bundle into it and signs it with the same key, skipping prebuild and Gradle. On a miss, the APK is built (Gradle cache, ccache) and saved under that key when the run is on `main`.
- iOS: the iOS job restores the simulator `Kaitech.app` cached under `ios-simulator-app-arm64-<fingerprint>` (built with `ARCHS=arm64 ONLY_ACTIVE_ARCH=YES`: the `macos-26` runners are arm64, so the simulator slice for x86_64 is never needed) and repacks only the JS bundle on a hit. On a miss it runs `pod install` and `xcodebuild` with Xcode compilation caching (`COMPILATION_CACHE_ENABLE_CACHING=YES`, CAS in `build/cas`, restored from the newest `ios-cas-<fingerprint>`), and saves the app and the CAS when the run is on `main`. A restored CAS over 3072 MB is emptied before the build, and a CAS over 3072 MB after the build is not saved; the older entry then keeps being restored and still serves the unchanged compile units. Measured on `macos-26` (ZHA-7503): xcodebuild universal 1663 s (run 45104149712), arm64 1063 s (run 45105105535); with compilation caching a build from an empty CAS took 663 to 716 s (runs 45107772111, 45110615596) and a clean rebuild against a saved CAS 259 s, CAS 2062 MB (run 45107772111). Pods are not cached: the entry took 2,102 MB of the quota and only saves `pod install` (130-221 s) on a fingerprint change; the CAS spends that space on the `xcodebuild` time instead.

Release builds never use these caches: every release artifact is compiled from source. `release.yml` writes no cache at all: a release on a tag cannot read entries another tag wrote, and a release dispatched on `main` (run 45104485957) wrote 2,861 MB of Gradle, ccache and CocoaPods entries that only a later release would restore, and releases are too rare to justify pushing the E2E set out of the 10 GB quota.

### Emulator

`reactivecircus/android-emulator-runner`, API 35, `x86_64`, `google_apis`. Every job boots a fresh, wiped emulator (`-no-snapshot -wipe-data`); no AVD snapshot is cached. A snapshot saved no time and took 3,172 MB (phone) and 3,545 MB (tablet) of the 10 GB cache quota: the phone smoke job took 222 s on a fresh boot (run 45098325387) and 225-235 s restoring the snapshot (runs 45105990091, 45109157578, 43 s of that the restore), with `android.cold_start_ms` 1159 ms fresh against 1111-1261 ms from the snapshot. `scripts/e2e-android.sh` sets `hide_error_dialogs` and closes system dialogs before installing the app: on a busy fresh emulator "Pixel Launcher isn't responding" covered the app and both smoke flows timed out (run 45058782312 attempt 3, `cmd-001-hierarchy.xml`). It also turns off Gboard auto-correction and auto-capitalisation (`auto_cap`, `pref_key_auto_correction`, `pref_key_latin_auto_correction`, `pref_key_pk_auto_correction`, `latin_pk_auto_capitalize` in Gboard's preferences, written as root to its device-protected storage `/data/user_de/0/com.google.android.inputmethod.latin/shared_prefs`; the same file under `/data/data` is not read, run 45265546614; Gboard 14.2 migrates `auto_cap` to `enable_auto_capitalization` on its next start), so the field holds exactly what Maestro typed: once Gboard's downloaded language model loaded, a space after a word replaced it with a capitalised form (`Uji baris todo` saved as `Uji baris Todo`, `Uji hapus` as `Uji Hapus`) in controlled and uncontrolled `TextInput`s alike, and steps that looked for the typed text failed at random (ZHA-7629, runs 45257517011 and 45261468274). Signed-in rows jobs need emulator audio for recording and start the emulator with it.

The emulator and the system image are installed by their own step before the emulator runner, up to three attempts, each checked by `package.xml` plus `system.img` in the image folder and `package.xml` plus the `emulator` binary in `emulator/`. The emulator package failed the same way in run 45237262799 (job 137914284394, "Android Emulator: Error reading Zip content"); before it was named in the step it was installed only as the image's dependency, which an emulator already on the runner would skip. `sdkmanager` does not verify the checksum of a download it has just finished, so a truncated response is unpacked and fails with "An error occurred while preparing SDK package ... Error reading Zip content"; the runner logged that warning, carried on and the emulator never started (run 45236073415, job 137911770103). The next `sdkmanager` call checks the leftover against the checksum and downloads it again. The emulator runner's own install then finds both packages in place and skips them.

### Flow runner

`scripts/e2e-android.sh` picks the runner per orientation with `E2E_RUNNER=auto` (the default): [maestro-runner](https://github.com/devicelab-dev/maestro-runner) (Go binary, driver `devicelab`) when the screen is in its natural orientation (phone portrait, tablet landscape), Maestro CLI when the script rotated it (phone landscape, tablet portrait). maestro-runner 1.1.31 resizes the screen only after `setOrientation`, not after `cmd window user-rotation lock`, so every tap in a rotated cell failed with "element rect not tappable" (run 45039148320). Signed-in rows stay on Maestro CLI (`E2E_RUNNER_ROWS`, default `maestro`): in that run rows-discovery and rows-mom failed with maestro-runner on the phone. The iPhone simulator and `maestro check-syntax` use Maestro CLI. The repository variables `E2E_RUNNER` (`auto`, `maestro`, `maestro-runner`) and `E2E_RUNNER_ROWS` switch runners without a pull request.

maestro-runner never drives Chrome through the DevTools protocol. Once its on-device agent reports a socket whose name contains `devtools_remote` while Chrome is in front, maestro-runner 1.1.31 switches to browser mode and resolves every `tapOn` with an id or text selector in the page DOM, so the Custom Tab's own `com.android.chrome:id/close_button` is never found. Whether that happened depended on how fast the lab0 page loaded: in run 45287370363 (push on `main`, 0682488) the page finished loading, the socket appeared 5 s after the tap and sign-in-form failed with "Element not found". `scripts/e2e-android.sh` renames Chrome's DevTools socket through `--remote-debugging-socket-name=kaitech_e2e_chrome` in `chrome-command-line`, so the agent never sees it, and fails the cell when `maestro-runner.log` still shows a socket of `type=browser`. A `webview_devtools_remote_<pid>` socket of another process may still appear (type `webview`, "no pages found"); it does not change how taps are resolved.

A/B on the same emulator (runs 45031368763, 45032009631, 45032023342, 45032703311): same results and failing steps with both runners, 44 to 58 percent shorter total time, 25 MB runner memory against 300 to 430 MB.

maestro-runner telemetry and update checks are off in every job (`MAESTRO_RUNNER_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`, `MAESTRO_RUNNER_NO_UPDATE_CHECK=1`, `open.devicelab.dev` resolved to `0.0.0.0`); `MAESTRO_RUNNER_TELEMETRY_DEBUG=1` prints any event that would have been built, and the script fails the cell when one is printed.

### Output

Every artifact is scanned by gitleaks before upload; nothing is uploaded when the scan fails. Smoke, android and full Android jobs upload `e2e-android-<mode>-<size>-<locale>` (one folder per orientation: video, `screenshots/`, `display.txt`, JUnit, logcat, `cold-start.txt`). Rows and MoM jobs upload `e2e-android-rows-*` and `e2e-android-mom-*` without recordings, app logs, or account values; their `audio.txt` keeps only the audio, media-recorder and recording-error lines of logcat, streamed for the whole run. The iOS job uploads `e2e-ios-en-US`.

## Release

1. `gitleaks`: the ref must be a commit on `main`; gitleaks over the full git history and the working tree.
2. `android apk (universal)` (four ABIs) and `android apk (arm64-v8a)`, signed with the release keystore and checked against `.github/android-release-cert.sha256`, ABIs, bundled JS secrets, perf gate; `ios ipa (unsigned)` and `ios bundle secret scan`.
3. Tags only: draft GitHub Release with the APKs, IPA and `SHA256SUMS.txt`; the draft is downloaded again for checksums, rotation, multi-window and iPad config inside the files (`scripts/check-release-artifacts.py`), and gitleaks over the unpacked APK and IPA; the universal APK is installed on a fresh emulator in eight cells (phone and tablet, portrait and landscape, `en-US` and `id-ID`), and the four signed-in rows cells run on it too (`rows from release`, fresh emulator, each cell in its `kaitech-e2e-account-<size>-<locale>` group); the release is published only when both pass.

A manual run from `main` stops after step 2: it builds the release APKs and IPA as run artifacts (`kaitech-android-apk`, `kaitech-android-apk-arm64-v8a`, `kaitech-ios-ipa`) without creating a release. Use it for a build of `main` between releases.

To release: raise `version` in `app.json` through a pull request, then after the merge `git tag v<version> && git push origin v<version>` on that `main` commit.

## Caches

Written only from `refs/heads/main` (push, nightly schedule, dispatch on `main`) and read by every pull request, branch and tag. GitHub lets a run read caches of its own ref and of `main`, never of another branch, and evicts the least recently used entries once the repository passes its 10 GB quota; caches written by branches were never read by anyone else and pushed the `main` set out (ZHA-7494: 12,440 MB in 16 entries, none on `main`). Gradle runs with `cache-read-only` outside `main`. One full E2E set on `main` measured 7,726 MB with the pods and AVD entries (runs 45104004339 and 45104149712); without them 2,452 MB, and with the iOS compilation cache about 4,500 MB (at most 5,524 MB with a 3,072 MB CAS), under the 8 GB target with room for a second fingerprint while LRU evicts the first. The one exception is `setup-node`'s npm cache, which saves on a `package-lock.json` it has not seen; the `cache cleanup` job removes it when the pull request closes.

Every job that touches a cache writes a table to its run summary: each cache with `hit`, `partial` (an older entry through a restore prefix), `miss` or `not used`, its key, and whether the ref writes.

| Cache | Content | Key |
|---|---|---|
| `native-apk-<variant>-<signing>-<fingerprint>` | x86_64 E2E APK | native fingerprint |
| `ios-simulator-app-arm64-<fingerprint>` | iPhone simulator app (arm64) | native fingerprint |
| `ios-cas-<fingerprint>` | Xcode compilation cache (LLVM CAS) for the simulator build | native fingerprint, restored from the newest |
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
| `KAITECH_E2E_LOGIN`, `KAITECH_E2E_PASSWORD`, `KAITECH_E2E_WEB_LOGIN`, `KAITECH_E2E_WEB_PASSWORD` | for rows and MoM | test account, rows and MoM jobs of `android` and `full` E2E only |

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
