# CI

| Workflow | Trigger | Contents |
|---|---|---|
| `CI` (`ci.yml`) | push to `main`, PR, manual | gitleaks over the whole history and the working tree; lint, typecheck, translation key parity, tablet configuration gate, Jest; APK and IPA builds, emulator E2E |
| `Build` (`build.yml`) | called by CI and Release | x86_64 release APK for E2E (every run) plus the four-ABI universal release APK and the `arm64-v8a` release APK (only `main`, tags, and manual runs), all signed, with their certificate fingerprint verified and their `lib/<abi>` contents checked; unsigned IPA (`xcodebuild`, macOS runner `xcode-27`), secret scan of the JS bundle, performance gate, Maestro E2E on the Android emulator (phone and tablet, portrait and landscape, `en-US` and `id-ID`, in parallel), universal APK E2E on tags, recording and screenshots per cell |
| `iPad trial` (`ipad-trial.yml`) | push to `main`, tag `v*`, manual | iPad simulator trial in `en-US`, outside the main CI so a CI run does not wait for the iPad; a new run on the same ref cancels the old one |
| `Release` (`release.yml`) | tag `v*` | reject a tag that does not point at a commit on `main`, gitleaks over the whole history, build, then a draft GitHub Release with the APK, the IPA, and `SHA256SUMS.txt`. The APK and IPA are downloaded back from that draft: checksums, rotation configuration, multi-window, and iPad inside the files (`scripts/check-release-artifacts.py`), gitleaks over the unpacked APK and IPA contents, then the APK is installed on a fresh emulator (no snapshot) in all eight phone and tablet cells. The Release is only published when all of them pass; a rerun after a failure uses the same draft |
| `gitleaks push` (`gitleaks.yml`) | push to a branch other than `main` and every tag | gitleaks over the whole history and the working tree |

E2E artifacts are only uploaded when gitleaks is clean.

Artifacts per run: `e2e-apk-x86_64` (the APK under E2E), `kaitech-android-apk` (universal APK) and `kaitech-android-apk-arm64-v8a` (`arm64-v8a` APK), both only on `main`, tags, and manual runs, `kaitech-ios-ipa`, `perf-android-x86_64`, `perf-android-universal`, `perf-android-arm64-v8a` and `perf-ios` (performance gate numbers), eight `e2e-android-<size>-<orientation>-<locale>` (video, `screenshots/`, `display.txt`, JUnit, logcat, Maestro output, `cold-start.txt` in the phone portrait `en-US` cell). The `iPad trial` run uploads `e2e-ipad-en-US` (one folder per cell, `simctl` video, `junit.xml`, Maestro output, the Maestro console log `maestro-console.log` (plus `maestro-console-attempt1.log` when the cell was retried), and Maestro screenshots in `screenshots/`). Release tags add `e2e-android-universal-phone-portrait-en-US` and eight `e2e-android-release-<size>-<orientation>-<locale>` (the APK downloaded from the Release draft, kept for 90 days).

## Fast path and cache

Android E2E only needs the x86_64 APK, so the job `android apk x86_64 (e2e)` builds one ABI and the E2E cells start as soon as that job finishes. The released APKs are the four-ABI universal APK from the job `android apk` and the `arm64-v8a` APK from the job `android apk arm64-v8a`; both run in parallel only on `main`, tags, and manual runs (`workflow_dispatch`, to measure size before a merge); on PRs both jobs are skipped (the check status still passes). As a result, on a PR the `arm64-v8a`, `armeabi-v7a`, and `x86` compilation only happens after the merge. A release tag runs one E2E cell (phone portrait `en-US`) on the universal APK before the GitHub Release is created. The runner emulator is x86_64, so the `arm64-v8a` APK is proven through the ABI check (`lib/` holds only `arm64-v8a`), the certificate, and a checksum equal to the file in the Release, not by installing it.

Caches, all written only outside `pull_request` (push to `main`, tags, manual runs) and read by PRs:

| Cache | Contents | Key |
|---|---|---|
| Gradle (`setup-gradle`) | dependencies, wrapper, Gradle build cache (`--build-cache`) | managed by the action |
| `ccache-android-<variant>-…` | NDK C/C++ compile output through `ccache` (`CMAKE_C*_COMPILER_LAUNCHER`) | hash of `package-lock.json`, `app.json`, `app.config.ts` |
| `ios-downloads-…` | CocoaPods downloads and prebuilt React Native/Hermes artifacts | the same hash |

Measured and not used: an emulator system image and AVD snapshot cache (restoring it takes as long as the download and a cold boot, while its size is 3 to 5 GB of the 10 GB repo cache quota), iOS ccache (React Native core and the Expo modules are already prebuilt, so there are no C compiler calls to cache), and a prebuilt container image (only Maestro and gitleaks could go into it, about 10 seconds per job).

## Performance gate

`scripts/perf-gate.mjs` compares every run's numbers with `perf/baseline.json` and fails the job when one number grows past its `maxIncrease`:

| Number | Measured in job | How |
|---|---|---|
| `android.apk_x86_64_bytes`, `android.apk_universal_bytes`, `android.apk_arm64-v8a_bytes` | `android apk x86_64 (e2e)`, `android apk`, `android apk arm64-v8a` | APK file size |
| `android.js_bundle_bytes` | every APK job | `assets/index.android.bundle` |
| `ios.ipa_bytes`, `ios.js_bundle_bytes` | `ios ipa (unsigned)` | size of the IPA and `main.jsbundle` |
| `android.cold_start_ms` | phone portrait `en-US` E2E cell | median `TotalTime` of 5 runs of `adb shell am start -W -S`, after one warm-up launch |

Size threshold 15 percent: at the same SHA the size does not change between runs, so an increase means a real change. Cold start threshold 100 percent because the median between runs on the shared runner emulator varies widely (965 to 1641 ms across nine runs, including four runs at the same SHA), so this gate only catches a cold start that rises to double; the numbers and their source runs are recorded in the `source` of each entry. A deliberate change updates `perf/baseline.json` in the same PR, with the reason in the PR description.

Release: bump `version` in `app.json` through a PR, then after the merge run `git tag v<version> && git push origin v<version>` on that `main` commit.

## GitHub secrets

| Secret | Required | Purpose |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | for releases | sign the APK with a non-store keystore |
| `GOOGLE_SERVICES_JSON` | no | contents of `google-services.json` (FCM). Without this secret the build stays green and Android push is off. |

Secret values are never written to the repo, logs, or artifacts. Credential files are rejected by `.gitignore`.

GitHub secret scanning and push protection are on, so a push containing a known secret is rejected before it lands. Third-party actions must be pinned to a commit SHA (repo rule). PRs from forks run without secrets (APK signed with the debug key, push off) and need the repo owner's approval before workflows run. The default workflow token is read-only. The release workflow only runs from tags in this repo.

Never write a real lab0 server address, token, database name, or real data to the repo. The default server comes from repo variables at build time, other servers from user input; examples and fixtures use made-up data.
