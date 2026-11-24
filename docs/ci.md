# CI/CD

Everything runs on GitHub Actions standard runners: `ubuntu-latest` for Linux work and Android emulators, `macos-26` (pinned, newest Xcode 26) for iOS. `macos-15` cannot build the app: its newest Xcode is 26.3, and Expo SDK 58's `expo-modules-jsi` fails to compile there (`JavaScriptObject.swift:946: error: sending 'slot' risks causing data races`, run 45043443333). There are three workflows and no others.

| Workflow | Triggers | Purpose |
|---|---|---|
| `CI` (`.github/workflows/ci.yml`) | push to `main` (not docs-only), every pull request, manual | Fast merge gate, Linux only, no emulator |
| `E2E` (`.github/workflows/e2e.yml`) | push to `main`, pull request labelled `run-e2e`, pull request that changes size inputs or is labelled `measure-ios` (`ios ipa size` only), nightly at 19:00 UTC (02:00 WIB), manual | Android emulator and iPhone simulator flows; iOS Release IPA size |
| `Release` (`.github/workflows/release.yml`) | tag `v*`, manual | Release APKs and IPA, GitHub Release |

Composite actions in `.github/actions/` hold the shared steps: `build-android-apk` (build or repack, sign, verify, upload an APK), `build-ios-ipa` (unsigned Release IPA, upload, size gate; used by `Release` and the E2E `ios ipa size` job), `android-e2e` (one emulator, Maestro flows, secret scan, upload), and the pinned, checksum-verified tool installers `setup-gitleaks`, `setup-maestro`, `setup-maestro-runner`, `setup-ccache`.

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

Full: four Android jobs (`pixel_6` and `pixel_tablet`, `en-US` and `id-ID`), each running portrait then landscape on the same emulator; four signed-in rows jobs (`.maestro/signed-in/rows-*.yaml`, phone and tablet, both locales; phone `en-US` runs with direct chats hidden), which then photograph the main screens in the light and the dark system theme (`.maestro/themed/tour.yaml`) and keep the frame statistics of a Chat list scroll (`.maestro/themed/scroll.yaml`, `scroll-gfxinfo.txt`); four signed-in MoM jobs (`.maestro/signed-in/mom-*.yaml`, phone and tablet, both locales) that start after the rows jobs of the run and take the same `kaitech-e2e-account-<size>-<locale>` group; four signed-in call jobs (`.maestro/signed-in/call.yaml`) that start once the APK is built, next to the rows jobs, and run one at a time in the group `kaitech-e2e-call` across runs, because each joins a headless web peer (`scripts/call-peer.mjs`) to the one test channel with its camera on, on an emulator with an emulated front camera. Call jobs swap the two accounts: the phone signs in as the web account (`KAITECH_E2E_WEB_LOGIN`) and the peer calls as the phone account, so the ring reaches only the call cell's emulator and never a rows or MoM cell of another run that is signed in as the phone account; and the iPhone simulator on `macos-26` (newest available iPhone on iOS 26 or newer, portrait then landscape, light then dark system theme, `DEVICE_SIZE=phone`). The signed-in Liquid Glass tour (`.maestro/ios/glass.yaml`: native tab bar, sheets, floating controls) runs only when the repository variable `APPLE_TEAM_ID` is set, which ZHA-7277 does: iOS returns the sign-in callback to the app only through the Universal Link, which needs the Apple Team ID in `apple-app-site-association`. Until then the step is skipped. Tablet layouts are tested on the Android tablet cells; iPad layouts are not tested in CI since ZHA-7503 (the iPad simulator job took 32 to 71 minutes and held every run behind it), only the iPad configuration inside the IPA (`scripts/check-release-artifacts.py`) and the tablet config gate.

Android: the full run without the iOS simulator. It is the proof for a feature branch before review (about 26 minutes, run 45095995935: APK 14 minutes, then the eight Android cells in 12). The iPad job alone took 32 to 71 minutes on a cold simulator build (runs 45069794592, 45070632107), so branch proof no longer waits for it; the nightly schedule and dispatches on `main` run `full` and carry the iOS proof.

The lock sits on the jobs that need it, not on the run. Each run signs in with one test account (see [Test accounts](#test-accounts)), and each rows, MoM and chat job takes the group `kaitech-e2e-account-<k>-<size>-<locale>` of that account with `queue: max` (account 0 keeps the old name `kaitech-e2e-account-<size>-<locale>`, so a branch that still carries an older `e2e.yml` queues with it): the four rows cells of one run still run side by side, as they always did, while the same cell never runs twice at once on the same account, so no test account ever carries more than the four distinct cells one full run puts on it. Two runs on different accounts never wait for each other. `rows from release` takes the same groups.

### Test accounts

The lab0 test accounts are CI-only: the device cleanup before every signed-in cell revokes the account's idle phones, so a person signed in with one would lose the session. Account `k` is a pair of lab0 users: the phone account the app signs in with (groups Role / User, Discovery Team Member and Chat Service Account, member of programme `KAITECH_E2E_PROGRAMME`) and the web peer that posts into their direct chat (Role / User, Discovery Team Member, Chat User). Account 0 is `zha7438_ci_phone` / `zha7438_ci_web` (chat 224); accounts 1 to 3 are `zha7641_ci_phone_<k>` / `zha7641_ci_web_<k>` (chats 929, 930, 931).

`scripts/e2e-account.sh` picks the account: the `account` input of a manual run (0 is refused while there are several accounts, since the call jobs own it), otherwise, with more than one account, account `1 + run number modulo (KAITECH_E2E_ACCOUNTS - 1)`, so rows, MoM and chat never use account 0 (unset or 1 means account 0 only). Account 0 is kept for the call jobs, which sign the phone in as its web user and let the web peer call as its phone user into chat 224: a rows, MoM or chat cell signed in as account 0 would see that call ring or its notice land in the chat it checks. The `plan` job of `E2E` and the `test account` job of `Release` run it; the signed-in jobs then read the secrets `KAITECH_E2E_LOGIN<suffix>`, `KAITECH_E2E_PASSWORD<suffix>`, `KAITECH_E2E_WEB_LOGIN<suffix>`, `KAITECH_E2E_WEB_PASSWORD<suffix>` and the variables `KAITECH_E2E_CHANNEL_ID<suffix>`, `KAITECH_E2E_PEER<suffix>`, where the suffix is empty for account 0 and `_<k>` otherwise. The programme, search term and MoM fixtures are shared, so cells of different accounts work in the same programme at the same time: a flow names what it creates after its `RUN` value, never after the cell (size, orientation, language). With cell names two accounts running the same cell found each other's meeting and could not remove it (`mom-followups.yaml`, runs 45299921825 and 45299925465: `mom-more-remove-*` not found).

Why four: replaying the job timings of the 121 full runs and Releases of 23 November against the account groups, one account gave a median wait of 66 minutes per rows cell and 100 per MoM cell (measured: 45 and 101); run number modulo 3 accounts left 0 and 10, modulo 4 left 0 and 0 with a 90th percentile of 10 and 15 minutes, and a fifth account cut the tail by only a few minutes. Since account 0 went to the call jobs, rows, MoM and chat rotate over the other three, the modulo-3 case of that replay.

Adding account `k`:

1. In lab0, create the phone and web users with the groups above, add the phone user to programme `KAITECH_E2E_PROGRAMME`, and have the web user open a direct chat with the phone user (`/discuss/get_or_create_chat`) and post one message each, so the chat is in the phone's list.
2. Store the four credentials as GitHub secrets with the `_<k>` suffix and as Wardmote company secrets `kaitech_e2e_account_<k>_login`, `_password`, `_web_login`, `_web_password`; set `KAITECH_E2E_CHANNEL_ID_<k>` to the chat id and `KAITECH_E2E_PEER_<k>` to the web user's name.
3. Prove it with a manual `android` run with `account` set to `k` (rows, MoM and chat cells green), then raise `KAITECH_E2E_ACCOUNTS` to `k + 1`.

Rollback: set `KAITECH_E2E_ACCOUNTS` to 1 and every run uses account 0 again; nothing else changes. The Android matrix and the iOS job never sign in (`scripts/e2e-ios.sh` runs only `.maestro/welcome.yaml` and `.maestro/sign-in-form.yaml`, without account values), so they hold no account group: the iOS job queues on its own group `kaitech-e2e-ios`, and a run's Android jobs never wait for another run's iOS job. A job that signs the phone in as `KAITECH_E2E_LOGIN` must take a `kaitech-e2e-account-*` group; the call jobs always use account 0 with the two accounts swapped and take `kaitech-e2e-call` instead. Android and full runs get a group of their own per run at workflow level. Pull request runs use `queue: single`, since GitHub rejects `queue: max` with `cancel-in-progress: true`.

The phone `en-US` call cell also runs the group and channel call (`.maestro/signed-in/call-many.yaml`, see [Calls](calls.md#calls-with-more-people)). Its second web peer is the web user of account 1 (`KAITECH_E2E_WEB_LOGIN_1`, `KAITECH_E2E_WEB_PASSWORD_1`), and it reads the variables `KAITECH_E2E_GROUP_CALL_ID`, `KAITECH_E2E_GROUP_CALL_NAME`, `KAITECH_E2E_CHANNEL_CALL_ID` and `KAITECH_E2E_CHANNEL_CALL_NAME` (lab0 group 1214 and channel 1215, whose members are the two account 0 users and the account 1 web user). Deleting `KAITECH_E2E_GROUP_CALL_ID` turns that stage off.

Every signed-in cell holds lab0 against a deploy while its flows run (`scripts/e2e-lease.sh`, `scripts/e2e-lease.mjs`): before the first flow it takes a `kaitech.mobile.e2e.lease` as its test account, renews it every minute (a lease lasts 180 seconds, so a cancelled job frees it on its own) and releases it after the last flow. lab0's `tools/deploy-lab0.sh` drains first: it refuses new leases, waits up to 30 minutes for held ones, and only then stops Odoo, so a deploy never lands under a running flow. A cell that finds lab0 draining or down waits up to `E2E_LEASE_WAIT_SECONDS` (1800) before its first flow and fails with `no E2E lease` after that; it never reruns a flow. Before this, every themed-tour failure of 24 November (`step-040`, Discovery showing "Server sedang bermasalah", main b94b163 run 45403174315 and PR #90 run 45411476840) fell inside a lab0 deploy (ZHA-7767).

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

Every artifact is scanned by gitleaks before upload; nothing is uploaded when the scan fails. Smoke, android and full Android jobs upload `e2e-android-<mode>-<size>-<locale>` (one folder per orientation: video, `screenshots/`, `display.txt`, JUnit, logcat, `cold-start.txt`). Rows and MoM jobs upload `e2e-android-rows-*` and `e2e-android-mom-*` without recordings, app logs, or account values; their `audio.txt` keeps only the audio, media-recorder and recording-error lines of logcat, streamed for the whole run. Call jobs upload `e2e-android-call-*` the same way, plus the web peer's log (`call-peer.json`) and a call-related app logcat (`call-logcat.txt`) with lines naming tokens, cookies, sessions, passwords or authorization dropped. Every signed-in cell first revokes the test account's devices idle for more than two hours (`scripts/e2e-prune-devices.mjs`, count in `devices-pruned.txt`), so both test accounts are for CI only: a phone signed in with one of them by hand is signed out once it sits idle that long. The prune exists because no cell signs out, and a call rings every device of the callee inside the join request, so stale emulators slowed joins past the call timer. The iOS job uploads `e2e-ios-en-US` (one folder per orientation and theme, for example `phone-portrait-en-US-dark`). `scripts/e2e-ios.sh` takes `APPEARANCES`, `ORIENTATIONS`, `MIN_IOS` and `E2E_FLOWS`, and a failed cell writes `screen-at-failure.txt`, the visible screen text with account values replaced by `***`.

## Release

1. `gitleaks`: the ref must be a commit on `main`; gitleaks over the full git history and the working tree.
2. `android apk (universal)` (four ABIs) and `android apk (arm64-v8a)`, signed with the release keystore and checked against `.github/android-release-cert.sha256`, ABIs, bundled JS secrets, perf gate; `ios ipa (unsigned)` and `ios bundle secret scan`.
3. Tags only: draft GitHub Release with the APKs, IPA and `SHA256SUMS.txt`; the draft is downloaded again for checksums, rotation, multi-window and iPad config inside the files (`scripts/check-release-artifacts.py`), and gitleaks over the unpacked APK and IPA; the universal APK is installed on a fresh emulator in eight cells (phone and tablet, portrait and landscape, `en-US` and `id-ID`), and the four signed-in rows cells run on it too (`rows from release`, fresh emulator, each cell in the account group of the test account the `test account` job picked); the release is published only when both pass.

A manual run from `main` stops after step 2: it builds the release APKs and IPA as run artifacts (`kaitech-android-apk`, `kaitech-android-apk-arm64-v8a`, `kaitech-ios-ipa`) without creating a release. Use it for a build of `main` between releases.

To release: raise `version` in `app.json` and add its section to [the changelog](changelog.md) in the same pull request, then after the merge `git tag v<version> && git push origin v<version>` on that `main` commit ([Cutting a release](releases.md#cutting-a-release)). The `gitleaks` job fails a tag whose version has no section in `docs/changelog.md`, and the draft release body is `.github/release-notes.md` plus that section.

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
| `ios.ipa_bytes`, `ios.js_bundle_bytes` | Release `ios ipa (unsigned)`, E2E `ios ipa size` |
| `android.cold_start_ms` | E2E phone portrait `en-US` (median of 5 `am start -W -S`) |

The iOS sizes need a Release build for `iphoneos` (about 24 minutes on `macos-26`), so `CI` never measures them. The E2E `ios ipa size` job builds it on a pull request that changes a size input (`package.json`, `package-lock.json`, `app.json`, `app.config.ts`, `fingerprint.config.js`, `metro.config.js`, `babel.config.js`, `assets/`, `plugins/`, `modules/`, `patches/`, `perf/`, the gate, the `build-ios-ipa` action or `e2e.yml`) or carries the label `measure-ios`, on a `full` dispatch, and every night on `main`; the `plan` job fails when it cannot list the pull request's files, so an unreadable list never skips the measurement. A pull request that grows the JS bundle without touching those files is caught that night; label it `measure-ios` to see its size before the merge. Before this job the IPA was measured only by `Release`, so the 1.65 MB that `@expo/ui` added to the iOS binary in pull request #50 surfaced only when the v0.5.0 tag stopped at +15.1% (ZHA-7773).

## Secrets and variables

| Secret | Required | Use |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | for releases | non-store APK signing key |
| `GOOGLE_SERVICES_JSON` | no | FCM; without it the build stays green and Android push is off |
| `KAITECH_E2E_LOGIN`, `KAITECH_E2E_PASSWORD`, `KAITECH_E2E_WEB_LOGIN`, `KAITECH_E2E_WEB_PASSWORD` | for rows and MoM | test account 0, rows, MoM and chat jobs of `android` and `full` E2E and `rows from release` only |
| the same four names with `_<k>` appended | for account `k` | test account `k` (see [Test accounts](#test-accounts)) |

Variables: `KAITECH_LINK_HOST`, `KAITECH_DEFAULT_DB` (build time), `KAITECH_E2E_ACCOUNTS`, `KAITECH_E2E_CHANNEL_ID` and `KAITECH_E2E_PEER` (each also with `_<k>` per account), `KAITECH_E2E_CALL_PEER` (account 0's phone user, which the call jobs open), `KAITECH_E2E_PROGRAMME`, `KAITECH_E2E_SEARCH`, `E2E_RUNNER`, `E2E_RUNNER_ROWS`.

Secret values never reach the repository, logs, or artifacts. Pull requests from forks run without secrets and need the owner's approval before workflows run. Third-party actions are pinned to a commit SHA. The default workflow token is read-only.

## Repository settings

- Branch protection on `main`: required checks `gitleaks diff`, `lint`, `typecheck`, `unit` (all from `CI`), branches up to date before merging.
- Label `run-e2e`: `gh label create run-e2e --color 0E8A16 --description "Run the E2E smoke on this pull request"`.
- Label `measure-ios`: `gh label create measure-ios --color 1D76DB --description "Build the Release IPA and check its size on this pull request"`.

## Local checks before a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run i18n:check
```

Changed workflows: `actionlint -ignore 'unexpected key "queue"'` (actionlint 1.7.12 does not know `concurrency.queue` yet). Changed flows: `maestro check-syntax <flow>`.
