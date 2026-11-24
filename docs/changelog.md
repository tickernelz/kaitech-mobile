# Changelog

Every release of Kaitech Mobile, newest first. Each version has one section, `## X.Y.Z - YYYY-MM-DD` (the day its tag was pushed, UTC), with the groups Added, Changed, Fixed and Known gaps; a group with nothing in it is left out. Every line names its pull request and task. The Release workflow copies the section into the body of the GitHub Release and stops a tag that has no section here. How to cut a release: [Releases](releases.md#cutting-a-release).

## 0.4.1 - 2026-11-23

### Changed

- E2E: the signed-in rows cells keep the audio and media-recorder lines of logcat (#68, ZHA-7506).

### Fixed

- MoM (Android): the recording service binds without losing its connection (#68, ZHA-7506).
- E2E: leave the Android sign-in fields with Enter instead of hiding the keyboard (#69, ZHA-7533).
- E2E: the iOS Maestro driver keeps serving after an XCTest issue (#73, ZHA-7574).

## 0.4.0 - 2026-11-23

First published release with the changes of 0.3.1, which was tagged but never published.

### Added

- MoM: More menus, processing status and recording actions, matching web lab0 (#39, ZHA-7442).
- Discovery: every web Discovery screen and action in the app (#43, ZHA-7441).
- People, Calls and Search tabs matching web lab0 (#44, ZHA-7443).
- Chat: thread actions, composer extras, the New menu and Coworker cards (#45, ZHA-7440).
- Settings: add a passkey from the phone (#53, ZHA-7443).
- Calls: blur the background of the local camera (#61, ZHA-7443).

### Changed

- Settings: device sessions load 20 more per tap (#62, ZHA-7443).
- Documentation moved to English pages under `docs/`; the README is a summary (#49, ZHA-7472).
- CI: three workflows, `ci.yml`, `e2e.yml` and `release.yml` (#60, ZHA-7480).
- CI: E2E `android` mode, a per-cell test account lock and the iPhone simulator (#65, ZHA-7503).
- CI: caches are written only from `main` and each job reports hits; no AVD snapshot, iOS pods or release cache writes (#63, ZHA-7488; #64, #66, #67, ZHA-7494).
- CI: signed-in rows cells run one at a time across runs and close the test account's leftover activities (#57, #58, ZHA-7476).
- A shared local emulator launcher with GPU host and one slot for every agent (#46, ZHA-7462).

### Fixed

- Settings: Sign out everywhere stays reachable on long device lists (#47, ZHA-7443).
- Chat: a conversation list refresh asked during a load runs after it instead of being dropped (#58, ZHA-7476).

## 0.3.1 - 2026-11-22

Not published: Release run 45003139812 failed in four E2E cells (`e2e android en-US`, `e2e android id-ID`, `e2e android rows phone id-ID`, `e2e android rows tablet id-ID`), so no GitHub Release exists for this tag. These changes first shipped in 0.4.0.

### Added

- Profile: status text in Settings and in the direct chat header (#38, ZHA-7436).
- Activity and Settings matching web lab0 (#40, ZHA-7443).
- A long-press More sheet and swipe actions on every list (#41, ZHA-7438).
- Chat: the web message actions in one long-press sheet (#42, ZHA-7440).

## 0.3.0 - 2026-11-21

### Added

- Coworker: voice notes, video and files (#21, ZHA-7381).
- Calls: native picture-in-picture for video calls (#24, ZHA-7394).
- Chat: conversation notifications with mute, reply and bubbles (#25, ZHA-7392).
- Kaitech chat wallpaper pack (#27, ZHA-7410).
- Discovery: Coworker blocks drawn natively instead of raw JSON, then every block kind (#31, ZHA-7421; #34, ZHA-7426).
- Chat: Markdown in bubbles and a format bar in composers (#33, ZHA-7425).
- Settings: profile, photos everywhere and chat backgrounds (#36, ZHA-7411).

### Changed

- Theme: neutral palette with a ranked accent and per-person colours (#28, ZHA-7412).
- One Kaitech icon set in `src/ui/icons` replaces the Material-like sets (#29, ZHA-7407).
- Icon-first refinement from the design audit (#32, ZHA-7406).
- Chat: formatted bubbles are drawn with fewer native views (#35, ZHA-7425).
- CI: the iPad trial is built with the default sign-in server (#26, ZHA-7379).

### Fixed

- Push: calls ring over the lock screen and message previews are hidden while locked (#20, ZHA-7382).
- Calls: only the call screen shows over the keyguard (#23, ZHA-7391).
- Calls: remote video keeps playing on Android (#30, ZHA-7402).

## 0.2.3 - 2026-11-21

### Added

- Sign-in: one tap signs in to the default lab0 server (#18, ZHA-7379).

### Fixed

- E2E: the emulator reboots to apply the locale (#19, ZHA-7378).

## 0.2.2 - 2026-11-21

### Added

- Calls: share the screen and record calls from the phone (#15, ZHA-7358).

### Changed

- Sign-in uses `lab0.kaitech.io` as the link host (#17, ZHA-7373). From this release the release builds carry the sign-in link domain and Android push; the 0.2.0 and 0.2.1 release notes said both were missing.

## 0.2.1 - 2026-11-21

No app code changed since 0.2.0 (only the version in `app.json`).

### Added

- Release: an arm64-v8a APK beside the universal APK (#16, ZHA-7362).

### Known gaps

- Sign-in does not work in this build: it was built without a link domain (`KAITECH_LINK_HOST`).
- Android push is off in this build: it was built without `google-services.json`, so messages and rings show only while the app is open.

## 0.2.0 - 2026-11-21

### Added

- App shell: sign-in, server setup, app lock, English and Indonesian (#2, ZHA-7236).
- Chat: conversations, thread, offline send queue, voice notes and push (#9, ZHA-7238).
- Calls: voice and video calls over LiveKit for chats, groups and channels (#11, ZHA-7240).
- Discovery: programme home, Coworker, decision cards, evidence, Activity and search (#8, ZHA-7242).
- MoM: record meetings in the background, resumable upload, minutes, items and Final MoM (#12, ZHA-7243).

### Changed

- App: follows the device rotation on phones and tablets (#3, ZHA-7265).
- Release: the APK and IPA are checked from a draft release before it is published (#14, ZHA-7244).
- CI: phone and tablet in both orientations (#3, ZHA-7265); an x86_64 APK for E2E, native compile caches and a performance gate (#4, #5, ZHA-7285); the iPad simulator trial outside the main run (#7, ZHA-7334; #10, ZHA-7338); the universal APK size recorded after calls (#13, ZHA-7240).

### Fixed

- E2E: dismiss the keyboard on iOS without the back swipe (#6, ZHA-7236).

### Known gaps

- Sign-in does not work in this build: it was built without a link domain (`KAITECH_LINK_HOST`).
- Android push is off in this build: it was built without `google-services.json`, so messages and rings show only while the app is open.

## 0.1.0 - 2026-11-20

### Added

- Expo SDK 58 app scaffold with APK and IPA builds in GitHub Actions (#1, ZHA-7234).

### Known gaps

- A scaffold only: no sign-in and no features yet. The release notes record only the build commit, the non-store APK keystore and the unsigned IPA.
