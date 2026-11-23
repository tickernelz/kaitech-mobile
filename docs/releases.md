# Releases

Download from [Releases](https://github.com/tickernelz/kaitech-mobile/releases/latest): `kaitech-<build>-<sha>-arm64-v8a.apk` for Android (almost every Android phone today; `kaitech-<build>-<sha>.apk` is the universal build for other phones), `kaitech-<build>-<sha>-unsigned.ipa` for iOS, and `SHA256SUMS.txt`. Check the download with `sha256sum -c --ignore-missing SHA256SUMS.txt`. These are test releases for the team, not store releases.

From v0.2.3 the Sign in button opens the lab0 sign-in page directly, with no form; another server can still be chosen through "Use another server". Sign-in on Android uses an App Link on the link domain `lab0.kaitech.io` (repo variable `KAITECH_LINK_HOST`), built into release builds from v0.2.2. A build without that variable, for example a PR from a fork, says on the sign-in screen that the link domain is not set.

Android push through FCM ships in release builds from v0.2.2 (secret `GOOGLE_SERVICES_JSON`); a build without that secret has no push, and its release notes say so.

Release build limits while there is no Apple Developer account:

- **iOS.** See [Install the IPA](install-ios.md): sign-in through a Universal Link, APNs, VoIP push, and CallKit need an Apple Developer account.

Install steps: [Android](install-android.md), [iOS](install-ios.md). How a release is cut: [CI](ci.md#performance-gate).

## Proven

All evidence comes from the Android emulator or the iPhone simulator; nothing has been tested on a physical device yet. Numbers and recordings from the emulator hold for the emulator.

| Area | Platform and size | Orientation | Language | Evidence |
|---|---|---|---|---|
| Install the APK from the Release on a clean emulator, welcome screen, the Sign in button opens the lab0 sign-in page with no form, the "Use another server" form checks the address and database and then returns to the default; on the phone also a rotation in the middle of the form without losing input | Android 15 phone (`pixel_6`) and 10-inch tablet (`pixel_tablet`) | portrait, landscape | en, id | job `install from release` in the Release run of every tag, recordings `e2e-android-release-*` |
| The same flow with the x86_64 APK | Android 15 phone and tablet | portrait, landscape | en, id | `E2E` workflow nightly (smoke: phone portrait en on every merge to `main`), recordings `e2e-android-*` |
| The same flow on iPhone (non-blocking) | iPhone simulator on the `macos-26` runner | portrait, landscape | en | `E2E` workflow nightly, artifact `e2e-ios-en-US` |
| Sign-in to lab0 from the CI APK through the App Link `lab0.kaitech.io`, verified by Android itself (`pm get-app-links`: verified), from the welcome screen until Chat opens | Android 15 phone (`pixel_6`) | portrait | en | local recording of the CI APK, not published (internal tracker ZHA-7373) |
| Sign in to the server, then sign out (F0) | Android phone and tablet | not recorded | en, id | local recording with a build that carries the link domain, not published (internal tracker ZHA-7236) |
| Chat: list, thread, offline send queue, attachments, voice messages, two panes on the tablet (F1) | Android phone and tablet | portrait, landscape | en, id | local recording (ZHA-7238) |
| Two-way voice call from phone to web, CallStyle ringing with a foreground service, landscape, picture-in-picture (F2) | Android phone | portrait, landscape | not recorded | local recording (ZHA-7240) |
| Discovery: Programme home, Coworker, decision cards, evidence, Activities, search (F3) | Android phone and tablet | portrait, landscape | en, id | local recordings of 8 cells (ZHA-7242) |
| MoM: record 22 minutes with the screen off, resume the upload after the process is killed and on a 256 kbit/s uplink, minutes and items (F4) | Android phone and tablet | portrait, landscape | en, id | local recordings of 8 cells (ZHA-7243) |

## Not yet verified

- iPad: the iPad simulator is not tested since ZHA-7503; only the iPad configuration inside the IPA is checked. A real iPad or iPhone has not been tested.
- Android split-screen, iPad Split View and Slide Over, foldables, 200% system font scale, and a physical keyboard on tablets. Their configuration is checked (free orientation, multi-window on, `UIRequiresFullScreen` off) in the release APK and IPA, but the behaviour has not been tested.
- Sign-in on iOS, APNs, VoIP push, CallKit, iOS Universal Links, MoM recording in the background and upload on iOS: need an Apple Developer account.
- Live Activity: not built yet; updating it from the server needs APNs.
- Android push reaching the device, including ringing while the app is dead and Decline from the notification while the app is dead: Firebase is in release builds from v0.2.2, the delivery test has not been done.
- A real lock screen (the emulator has no keyguard) and battery usage.
- Discovery on iPad: only tested on the Android emulator.
- MoM on a phone in landscape: once recorded "recording couldn't start" on the emulator and has not happened again; its native error now goes to logcat if it shows up again.
