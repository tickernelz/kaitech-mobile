# E2E

Maestro flows live in `.maestro/`. Run them locally on an emulator that already has the APK installed:

```bash
maestro test .maestro
```

In CI every flow runs twice, on emulators with the `en-US` and `id-ID` locales. `scripts/e2e-android.sh` changes the system locale (`persist.sys.locale`, then a framework restart), waits until the framework configuration uses that locale, installs the release APK, records the screen, then runs every flow with the `APP_LANGUAGE` variable (`en` or `id`) for the texts it checks, for example `${APP_LANGUAGE === 'id' ? 'Selamat datang' : 'Welcome'}`. Checking elements through `testID` is preferred. The `sign-in-form` flow opens the lab0 sign-in page from the Sign in button with no form, then through "Use another server" checks an empty address or one without https and a wrong database name, rotates the screen to the other orientation and back without losing the field contents, and returns to the default.

Run locally: `maestro test -e APP_LANGUAGE=id -e DEVICE_SIZE=phone -e ORIENTATION=portrait .maestro`. All three variables must be passed through `-e`; do not give them defaults in a flow's `env:` block, because that value overrides `-e`.

## Shared local emulator

E2E, video recordings, screenshots, and the full suite run in GitHub Actions; take videos and images from the `e2e-android-*` artifacts of a green run at the SHA in question. Flows CI cannot reach may run on a physical phone. A developer PC runs at most ONE emulator for all runs at once, and only through `scripts/emulator.sh`:

```bash
scripts/emulator.sh run phone -- bash scripts/e2e-android.sh dist e2e-output/phone-portrait-en-US en-US phone portrait
scripts/emulator.sh run tablet -- sh -c 'maestro --device "$ANDROID_SERIAL" test -e APP_LANGUAGE=en -e DEVICE_SIZE=tablet -e ORIENTATION=landscape .maestro'
scripts/emulator.sh status
scripts/emulator.sh stop
```

- Two shared AVDs, `kaitech-phone` (`pixel_6`) and `kaitech-tablet` (`pixel_tablet`), Android 15 `google_apis` x86_64, created automatically on first use with the profile's default RAM, the same as CI. Do not create an AVD per task.
- The emulator runs on `emulator-5584` (inside the 5555-5585 range the adb server rescans after `adb kill-server`) with `-gpu host -read-only -no-snapshot -no-window -no-audio -no-boot-anim` as the user systemd unit `kaitech-emulator` (`Nice=10`, `CPUQuota=400%`, `MemoryMax=8G`). `-read-only` makes every boot clean.
- One `flock` lock at `$XDG_RUNTIME_DIR/kaitech-emulator/lock`: a run that arrives while another run uses the emulator waits its turn (or use CI). The launcher refuses to start an emulator (exit code 3) while any other emulator runs on the PC, including one started without the launcher, and prints the list.
- A live emulator of the same size is reused: the launcher runs `pm clear io.kaitech.mobile`, then your command with `ANDROID_SERIAL` pointing at that emulator, under `nice`. Another size stops that emulator first. `adb` follows `ANDROID_SERIAL`, Maestro does not: always pass `maestro --device "$ANDROID_SERIAL"`, because without it Maestro picks another connected device, including a physical phone over USB.
- The `kaitech-emulator-reap` timer is armed as soon as a run takes the lock and armed again after the command finishes. It checks every `KAITECH_EMULATOR_IDLE_MINUTES` (default 5) minutes and stops the emulator and itself once the lock is free, so a killed run (Ctrl-C, timeout, SIGKILL, OOM) does not leave the emulator running. `scripts/emulator.sh stop` stops it at once and exits with code 75 when another run is using the emulator; run it as soon as you are done.
- `KAITECH_EMULATOR_GPU=swangle_indirect` only to compare or when the host GPU misbehaves, with a written reason; software rendering is the emulator's largest CPU cost.
- CI does not use this launcher: GitHub runners have no GPU and keep `swiftshader_indirect`.

## Device matrix

The superapp must be responsive on phones and tablets, Android and iOS, portrait and landscape. Every Android cell is its own job with its own emulator, so all eight cells run in parallel.

| Platform | Size | Device | Window width portrait / landscape | Orientation | Language | Status |
|---|---|---|---|---|---|---|
| Android 15 (API 35) | `phone` | emulator profile `pixel_6` | 411 dp (compact) / 914 dp | portrait, landscape | `en-US`, `id-ID` | must be green |
| Android 15 (API 35) | `tablet` | emulator profile `pixel_tablet` (10 inch) | 800 dp (medium) / 1280 dp (expanded) | portrait, landscape | `en-US`, `id-ID` | must be green |
| iOS (latest simulator runtime on the `macos-26` runner) | `phone` | newest available iPhone simulator (iPhone 17 Pro, then iPhone 17, 16 Pro, 16) | see `simulator.txt` | portrait, landscape | `en-US` | job `ios simulator en-US` in the full `E2E` run (nightly, manual), not a merge gate; the Maestro XCTest driver gets a 10-minute start timeout (`MAESTRO_DRIVER_STARTUP_TIMEOUT=600000`) and the cell is retried once only when it fails with `IOSDriverTimeoutException`; the driver is built from the pinned Maestro source with `scripts/maestro-ios-runner.patch` (`scripts/maestro-ios-runner.sh`, cached per Maestro version and patch), because stock Maestro lets any issue XCTest records inside `testHttpServer` (an accessibility element that vanished while the status bar is read, mobile-dev-inc/Maestro#3538; the 30-second orientation timeout of ZHA-7557) end the test and with it the driver's HTTP server, failing the rest of the cell with `DeviceUnreachableException`; the patched driver logs the issue (`XCTest issue kept out of the test run`) and keeps serving |

Android orientation is set through `user_rotation`, taking the panel's natural orientation into account (tablets are naturally landscape); the iPhone simulator uses Maestro's `setOrientation` in the `onFlowStart` hook (`.maestro/shared/orientation.yaml`), because the Maestro XCTest runner returns the simulator to portrait on every new session. Every new flow must include that hook:

```yaml
onFlowStart:
  - runFlow: shared/orientation.yaml
```

On Android the hook does nothing. The panel size, density, and rotation of each cell are recorded in `display.txt`. The iPhone simulator needs no signature or Apple account. The iPad simulator is not tested since ZHA-7503 (its job took 32 to 71 minutes and held every run behind it); a real iPad or iPhone has not been tested.

Screenshots are named `<screen>-<size>-<orientation>-<language>.png`, for example `launch-tablet-landscape-id.png`, through a shared subflow:

```yaml
- runFlow:
    file: shared/screenshot.yaml
    env:
      SCREEN: launch
```

Every cell screenshot is copied to `screenshots/`. `scripts/check-screenshots.mjs` fails the cell when a screenshot does not follow the name pattern or its dimensions do not match the cell's orientation (for example a screen locked to portrait in a landscape cell). iOS screenshots are stored in a portrait frame with an EXIF orientation tag; the check uses the dimensions after that tag is applied. Flows in the `.maestro/shared/` subfolder are not run on their own.

## Tablet configuration gate

`node scripts/check-tablet-config.mjs` (a CI step in the lint job) fails when `orientation` is not `default`, `ios.supportsTablet` is not `true`, `ios.requireFullScreen` is `true`, or the `expo prebuild` output locks `android:screenOrientation`, turns off `android:resizeableActivity`, turns on `UIRequiresFullScreen`, or does not support all four iPad orientations.

The sign-in to sign-out flows live in `.maestro/signed-in/` and are not part of `maestro test .maestro` in CI, because they need a test account and a build with `KAITECH_LINK_HOST` and `KAITECH_DEFAULT_DB`; these flows sign in to the default server. Run them with `maestro test -e APP_LANGUAGE=id -e DEVICE_SIZE=phone -e ORIENTATION=portrait -e LOGIN=<account> -e PASSWORD=<password> .maestro/signed-in`; never write those values to the repo, logs, or public artifacts.

The `signed-in/discovery.yaml` flow signs in when needed, then opens the Programme home, findings and their evidence, asks the Coworker (on an Android phone the screen is rotated in the middle of typing to prove the draft survives), decision cards when one is waiting, combined search, and Activities. Extra variables: `-e QUESTION=<question> -e SEARCH=<word>`. Run it only with a test account that is a member of test Programmes only; the recording shows the Programme contents.

The `signed-in/discovery-sections.yaml` flow signs in only when the app is signed out, opens All sections from the Programme home, the Programme detail and its More sheet, Knowledge, one section from every web menu group (list, first record, More sheet), then creates a new Glossary term and taps Accept. Extra variables: `-e TERM=<unique term>` and `-e PROGRAMME=<test Programme name>` (picked in the Programme picker first); the flow creates data in the open Programme.

The `signed-in/discovery-all-sections-1.yaml` to `-3.yaml` flows open every web Discovery menu the test account can see (64 menus, split in three so one emulator crash does not lose the whole run), wait for the list, and open the first record; no step changes data. `signed-in/discovery-actions.yaml` taps Pause, Resume and Snooze Proactive on the Programme, checks that accepting a RAID without evidence is refused by the server with its reason, rejects one RAID, and posts a note on a Department; variables `-e NOTE=<text> -e RAID_ACCEPT=<RAID name> -e RAID_REJECT=<RAID name>`. `signed-in/discovery-decisions.yaml` accepts and rejects a Department and rejects a Glossary term; variables `-e DEPT_ACCEPT= -e DEPT_REJECT= -e TERM_REJECT=` hold names of test records still in Draft. Every record these flows use must be test data you created in a test Programme.

`themed/tour.yaml` photographs Chat, the row More sheet, Discovery, MoM, Activity and Settings as `<theme>-t<n>-<screen>-<size>-<orientation>-<language>.png`; `scripts/e2e-android.sh` runs the flows in `E2E_THEMED_FLOWS` once with `adb shell cmd uimode night no` and once with `yes`, so the theme changes on the emulator and not in the account's Appearance setting, which parallel cells share. Before every tap and screenshot it waits for an incoming call from another job to go away (`shared/no-ring.yaml`) and never declines it. `E2E_SCROLL_FLOW` (`themed/scroll.yaml`, after `scroll-ready.yaml` opens the list) swipes the Chat list six times down and up between a `dumpsys gfxinfo` reset and dump and saves `scroll-gfxinfo.txt`. The rows job sets both through the `themed-flows` and `scroll-flow` inputs of `.github/actions/android-e2e`.

The Chat flows (`signed-in/chat.yaml`, `signed-in/message-actions.yaml`) are described in [Architecture: Chat](architecture.md#chat-srcfeatureschat), the row action flows in [Architecture: Row actions](architecture.md#row-actions-srcuirowactionstsx), and the call check in [Calls](calls.md#trying-a-call-from-this-machine).
