# E2E

Maestro flows live in `.maestro/`. Run them locally on an emulator that already has the APK installed:

```bash
maestro test .maestro
```

In CI every flow runs twice, on emulators with the `en-US` and `id-ID` locales. `scripts/e2e-android.sh` changes the system locale (`persist.sys.locale`, then a framework restart), waits until the framework configuration uses that locale, installs the release APK, records the screen, then runs every flow with the `APP_LANGUAGE` variable (`en` or `id`) for the texts it checks, for example `${APP_LANGUAGE === 'id' ? 'Selamat datang' : 'Welcome'}`. Checking elements through `testID` is preferred. The `sign-in-form` flow opens the lab0 sign-in page from the Sign in button with no form, then through "Use another server" checks an empty address or one without https and a wrong database name, rotates the screen to the other orientation and back without losing the field contents, and returns to the default.

Run locally: `maestro test -e APP_LANGUAGE=id -e DEVICE_SIZE=phone -e ORIENTATION=portrait .maestro`. All three variables must be passed through `-e`; do not give them defaults in a flow's `env:` block, because that value overrides `-e`.

## Device matrix

The superapp must be responsive on phones and tablets, Android and iOS, portrait and landscape. Every Android cell is its own job with its own emulator, so all eight cells run in parallel.

| Platform | Size | Device | Window width portrait / landscape | Orientation | Language | Status |
|---|---|---|---|---|---|---|
| Android 15 (API 35) | `phone` | emulator profile `pixel_6` | 411 dp (compact) / 914 dp | portrait, landscape | `en-US`, `id-ID` | must be green |
| Android 15 (API 35) | `tablet` | emulator profile `pixel_tablet` (10 inch) | 800 dp (medium) / 1280 dp (expanded) | portrait, landscape | `en-US`, `id-ID` | must be green |
| iPadOS (latest simulator runtime on the `macos-26` runner) | `tablet` | iPad Pro 13-inch simulator (or another iPad when it is missing) | see `simulator.txt` | portrait, landscape | `en-US` | job `ipad simulator en-US` in the full `E2E` run (nightly, manual), not a merge gate; the Maestro XCTest driver gets a 10-minute start timeout (`MAESTRO_DRIVER_STARTUP_TIMEOUT=600000`) and the cell is retried once only when it fails with `IOSDriverTimeoutException` |

Android orientation is set through `user_rotation`, taking the panel's natural orientation into account (tablets are naturally landscape); the iPad uses Maestro's `setOrientation` in the `onFlowStart` hook (`.maestro/shared/orientation.yaml`), because the Maestro XCTest runner returns the simulator to portrait on every new session. Every new flow must include that hook:

```yaml
onFlowStart:
  - runFlow: shared/orientation.yaml
```

On Android the hook does nothing. The panel size, density, and rotation of each cell are recorded in `display.txt`. The iPad simulator needs no signature or Apple account; a real iPad has not been tested.

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

The Chat flows (`signed-in/chat.yaml`, `signed-in/message-actions.yaml`) are described in [Architecture: Chat](architecture.md#chat-srcfeatureschat), the row action flows in [Architecture: Row actions](architecture.md#row-actions-srcuirowactionstsx), and the call check in [Calls](calls.md#trying-a-call-from-this-machine).
