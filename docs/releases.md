# Releases

Download from [Releases](https://github.com/tickernelz/kaitech-mobile/releases/latest): `kaitech-<build>-<sha>-arm64-v8a.apk` for Android (almost every Android phone today; `kaitech-<build>-<sha>.apk` is the universal build for other phones), `kaitech-<build>-<sha>-unsigned.ipa` for iOS, and `SHA256SUMS.txt`. Check the download with `sha256sum -c --ignore-missing SHA256SUMS.txt`. These are test releases for the team, not store releases.

From v0.2.3 the Sign in button opens the lab0 sign-in page directly, with no form; another server can still be chosen through "Use another server". Sign-in on Android uses an App Link on the link domain `lab0.kaitech.io` (repo variable `KAITECH_LINK_HOST`), built into release builds from v0.2.2. A build without that variable, for example a PR from a fork, says on the sign-in screen that the link domain is not set.

Android push through FCM ships in release builds from v0.2.2 (secret `GOOGLE_SERVICES_JSON`); a build without that secret has no push, and its release notes say so.

Release build limits while there is no Apple Developer account:

- **iOS.** See [Install the IPA](install-ios.md): sign-in through a Universal Link, APNs, VoIP push, and CallKit need an Apple Developer account.

Install steps: [Android](install-android.md), [iOS](install-ios.md). What changed in each release: [Changelog](changelog.md).

## Cutting a release

Every release ships a changelog: its section in [changelog.md](changelog.md) and the same text on its GitHub Release page.

1. Branch from `main` and raise `version` in `app.json` (and `package.json` with `npm version X.Y.Z --no-git-tag-version --ignore-scripts`): minor when features landed, patch for fixes only.
2. In the same pull request, add `## X.Y.Z - YYYY-MM-DD` (the day you will tag it, UTC) at the top of `docs/changelog.md`. List every pull request merged since the last tag (`git log --first-parent --merges v<last>..origin/main`) under Added, Changed, Fixed, and what the release does not do yet under Known gaps; every line names its pull request and ZHA task.
3. After the merge, tag that `main` commit: `git tag vX.Y.Z <merge sha> && git push origin vX.Y.Z`. The Release workflow ([CI](ci.md#release)) stops in its first job when `docs/changelog.md` at that commit has no `## X.Y.Z` section; otherwise the release body is `.github/release-notes.md`, the build notes and the changelog section.
4. Check the published page: `gh release view vX.Y.Z --json isDraft,body,assets`. A correction goes to `docs/changelog.md` through a pull request, then `gh release edit vX.Y.Z --notes-file <file>` copies it to the page.

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

### Android push on a physical phone (ZHA-7944)

Meizu Mblu 21, Android 17, APK v0.8.0 (versionCode 949) and the same build with the Answer fix, account `zha7238_tablet` on lab0, sender a web account posting through lab0. Latency is from the HTTP request on the sender to the notification entering the phone's notification manager (`notification_enqueue` in the system event log, phone clock offset measured per trial). Script: `scripts/push-latency.mjs`; flows: `.maestro/local/push-message-open.yaml`, `.maestro/local/push-call-answer.yaml`.

| Case | App state | Delivered | Median | Max |
|---|---|---|---|---|
| Chat message | background (Home) | 5/5 | 1.20 s | 1.30 s |
| Chat message | swiped from recents | 5/5 | 1.29 s | 1.66 s |
| Chat message | force-stopped in Settings | 0/5 | - | - |
| Incoming call | background | 5/5 | 1.14 s | 3.79 s |
| Incoming call | swiped from recents | 5/5 | 1.24 s | 1.39 s |
| Incoming call | process killed, screen locked | 5/5 | 2.3 s | 2.7 s |
| Incoming call | force-stopped in Settings | 0/5 | - | - |
| Activity assigned to me (reminder) | background | 5/5 (0/5 before lab0 `c9a26930`) | 2.17 s | 5.37 s |
| Activity assigned to me (reminder) | swiped from recents | 5/5 | 2.49 s | 2.56 s |

- Force-stopped: Android cancels FCM for a force-stopped app (`GCM: broadcast intent callback: result=CANCELLED`) until the user opens it again. This is Android behaviour, not a Kaitech fault; [Install the APK](install-android.md#notifications) tells users not to force-stop the app.
- Ringing with the app killed: the call ends on the phone 0.76 to 1.06 s after the caller hangs up (5/5).
- Locked phone, app killed: the ring opens the full-screen call over the keyguard (`Occluded=true`, 7/7); Decline there stops the ring in 0.84 to 0.93 s (5/5) and the phone stays locked; Answer opens the call in 3.1 s (2/2) and the server holds both RTC sessions.
- Unlocked, app killed, CallStyle notification: Decline stops the ring in 0.97 to 1.06 s (5/5) and the phone does not join. Answer did nothing in v0.8.0 and earlier (the action was a broadcast that only logged, and Android 12+ forbids opening an activity from it); after the fix Answer opens the call in 3.5 to 5.1 s (5/5) and the server holds both RTC sessions.
- Tapping a message notification with the app killed opens that conversation in 6.1 to 6.5 s, never on a blank screen. Up to v0.8.0 it opened at the cached bottom and left the new messages below the screen when several arrived while the app was dead (2/2 with eight new messages, 2/12 with one); the thread now goes to its end once the server page lands, unless the reader has a saved position or scrolled first (ZHA-7944).
- Sign-out: the device is revoked on lab0 and its push token removed within 2 s; the signed-out account then got 0/3 pushes on that phone, while the account still signed in got 3/3. A signed-out account that never was the active account (the second account on the phone) gets no push: only the active account registers its token.
- Reminders: lab0 notifies 142 of 143 internal users by email, and Odoo web-pushes a direct notification (an activity assigned, a project deadline reminder) only to people notified in Odoo, so phones never heard of them. `kaitech_mobile` now pushes those to the phones of email-notified people too, worded by the notification's subject (`"<record>: <summary>" assigned to you`, `Deadline reminder: <task>`); live on lab0 since 26 November 2026 (`c9a26930`). The first deployed version showed the email's first line ("Dear <name> ,") instead.

## Not yet verified

- iPad: the iPad simulator is not tested since ZHA-7503; only the iPad configuration inside the IPA is checked. A real iPad or iPhone has not been tested.
- Android split-screen, iPad Split View and Slide Over, foldables, 200% system font scale, and a physical keyboard on tablets. Their configuration is checked (free orientation, multi-window on, `UIRequiresFullScreen` off) in the release APK and IPA, but the behaviour has not been tested.
- Sign-in on iOS, APNs, VoIP push, CallKit, iOS Universal Links, MoM recording in the background and upload on iOS: need an Apple Developer account.
- Live Activity: not built yet; updating it from the server needs APNs.
- Battery usage, and push delivery after hours of Doze (every push measurement above ran within minutes of the last use).
- Push on other phone makers' batteries savers (Xiaomi, Oppo, Vivo, Samsung): only the Meizu Mblu 21 was measured.
- Discovery on iPad: only tested on the Android emulator.
- MoM on a phone in landscape: once recorded "recording couldn't start" on the emulator and has not happened again; its native error now goes to logcat if it shows up again.
