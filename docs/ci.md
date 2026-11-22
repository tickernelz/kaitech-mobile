# CI/CD

Everything runs on GitHub Actions standard runners: `ubuntu-latest` for Linux work and Android emulators, `macos-15` (pinned, Xcode 26) for iOS. There are three workflows and no others.

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
| `lint` | `npm run lint`, the tablet config gate (`scripts/check-tablet-config.mjs`), `maestro check-syntax` over every flow |
| `typecheck` | `npm run typecheck` |
| `unit` | `npm run i18n:check` and `npm test -- --ci` (Jest) |

A new push to a pull request cancels its run in progress. Target: under 3 minutes wall time.

Docs-only changes (`docs/**`, `*.md`): pushes to `main` are skipped through `paths-ignore`. Pull requests are not filtered at the trigger, because a required check of a workflow that never starts stays "Expected" and blocks the merge. Instead the `changes` job lists the pull request files, and on a docs-only pull request every required job reports skipped, which branch protection accepts.

## E2E

The `plan` job picks a mode:

| Event | Mode |
|---|---|
| push to `main` (a merge) | smoke |
| pull request with the `run-e2e` label (labelling it, or pushing while it is labelled) | smoke |
| schedule, 19:00 UTC daily | full |
| manual (`workflow_dispatch`) | `mode` input, smoke by default |

Smoke: one Android emulator (`pixel_6`, portrait, `en-US`) runs `.maestro/welcome.yaml` and `.maestro/sign-in-form.yaml` with a screen recording, and measures cold start (perf gate `android.cold_start_ms`). It never uses the test account.

Full: four Android jobs (`pixel_6` and `pixel_tablet`, `en-US` and `id-ID`), each running portrait then landscape on the same emulator; five signed-in rows jobs (`.maestro/signed-in/rows-*.yaml`, phone and tablet, both locales, plus phone `en-US` with direct chats hidden); and the iPad simulator on `macos-15`. Full runs share the concurrency group `kaitech-e2e-account` because the rows jobs sign in with the one test account, so full runs never overlap each other.

Pull request runs of the same pull request cancel each other; labelling a pull request with another label does not cancel a running E2E run.

### Native fingerprint cache

`@expo/fingerprint` hashes everything that decides the native build: native dependencies and autolinking, config plugins, the resolved Expo config, `patches/`, and through `fingerprint.config.js` the whole of `modules/kaitech-call/`, `plugins/`, and `app.config.ts`. Code under `src/` is not part of it.

- Android: the `android apk x86_64` job restores the x86_64 release APK cached under `native-apk-x86_64-<signing>-<fingerprint>`. On a hit, `@expo/repack-app` (`--js-bundle-only`) puts this commit's Hermes bundle into it and signs it with the same key, skipping prebuild and Gradle. On a miss, the APK is built (Gradle cache, ccache) and saved under that key.
- iOS: the iPad job restores the simulator `Kaitech.app` cached under `ios-simulator-app-<fingerprint>` and repacks only the JS bundle on a hit. On a miss it restores `ios/Pods`, `Podfile.lock` and the CocoaPods and React Native download caches under `ios-pods-<fingerprint>`, runs `pod install` and `xcodebuild`, and saves both.

Release builds never use these caches: every release artifact is compiled from source.

### Emulator

`reactivecircus/android-emulator-runner`, API 35, `x86_64`, `google_apis`. E2E jobs boot from an AVD snapshot cached per profile (`avd-api35-x86_64-google_apis-<profile>-v1`, written outside pull requests) and never save it back (`-no-snapshot-save`). Release install checks boot a fresh, wiped emulator without snapshots.

### Flow runner

`scripts/e2e-android.sh` picks the runner per orientation with `E2E_RUNNER=auto` (the default): [maestro-runner](https://github.com/devicelab-dev/maestro-runner) (Go binary, driver `devicelab`) when the screen is in its natural orientation (phone portrait, tablet landscape), Maestro CLI when the script rotated it (phone landscape, tablet portrait). maestro-runner 1.1.31 resizes the screen only after `setOrientation`, not after `cmd window user-rotation lock`, so every tap in a rotated cell failed with "element rect not tappable" (run 45039148320). Signed-in rows stay on Maestro CLI (`E2E_RUNNER_ROWS`, default `maestro`): in that run rows-discovery and rows-mom failed with maestro-runner on the phone. The iPad simulator and `maestro check-syntax` use Maestro CLI. The repository variables `E2E_RUNNER` (`auto`, `maestro`, `maestro-runner`) and `E2E_RUNNER_ROWS` switch runners without a pull request.

A/B on the same emulator (runs 45031368763, 45032009631, 45032023342, 45032703311): same results and failing steps with both runners, 44 to 58 percent shorter total time, 25 MB runner memory against 300 to 430 MB.

maestro-runner telemetry and update checks are off in every job (`MAESTRO_RUNNER_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`, `MAESTRO_RUNNER_NO_UPDATE_CHECK=1`, `open.devicelab.dev` resolved to `0.0.0.0`); `MAESTRO_RUNNER_TELEMETRY_DEBUG=1` prints any event that would have been built, and the script fails the cell when one is printed.

### Output

Every artifact is scanned by gitleaks before upload; nothing is uploaded when the scan fails. Smoke and full Android jobs upload `e2e-android-<mode>-<size>-<locale>` (one folder per orientation: video, `screenshots/`, `display.txt`, JUnit, logcat, `cold-start.txt`). Rows jobs upload `e2e-android-rows-*` without recordings, logs, or account values. The iPad job uploads `e2e-ipad-en-US`.

## Release

1. `gitleaks`: the ref must be a commit on `main`; gitleaks over the full git history and the working tree.
2. `android apk universal` (four ABIs) and `android apk arm64-v8a`, signed with the release keystore and checked against `.github/android-release-cert.sha256`, ABIs, bundled JS secrets, perf gate; `ios ipa (unsigned)` and `ios bundle secret scan`.
3. Tags only: draft GitHub Release with the APKs, IPA and `SHA256SUMS.txt`; the draft is downloaded again for checksums, rotation, multi-window and iPad config inside the files (`scripts/check-release-artifacts.py`), and gitleaks over the unpacked APK and IPA; the universal APK is installed on a fresh emulator in eight cells (phone and tablet, portrait and landscape, `en-US` and `id-ID`); then the release is published.

A manual run from `main` stops after step 2: it builds the release APKs and IPA as run artifacts (`kaitech-android-apk`, `kaitech-android-apk-arm64-v8a`, `kaitech-ios-ipa`) without creating a release. Use it for a build of `main` between releases.

To release: raise `version` in `app.json` through a pull request, then after the merge `git tag v<version> && git push origin v<version>` on that `main` commit.

## Caches

Written outside pull requests and read by them, except the native APK cache, which pull requests also write for their own later pushes.

| Cache | Content | Key |
|---|---|---|
| `native-apk-<variant>-<signing>-<fingerprint>` | x86_64 E2E APK | native fingerprint |
| `ios-simulator-app-<fingerprint>` | iPad simulator app | native fingerprint |
| `ios-pods-<fingerprint>` | `ios/Pods`, `Podfile.lock`, CocoaPods and React Native downloads | native fingerprint |
| `avd-api35-x86_64-google_apis-<profile>-v1` | AVD with a booted snapshot | profile |
| Gradle (`setup-gradle`) | dependencies, wrapper, Gradle build cache | managed by the action |
| `ccache-android-<variant>-…` | NDK C/C++ objects | `package-lock.json`, `app.json`, `app.config.ts` |
| `ios-downloads-…` | CocoaPods and React Native downloads (release IPA) | same files |

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

Changed workflows: `actionlint`. Changed flows: `maestro check-syntax <flow>`.
