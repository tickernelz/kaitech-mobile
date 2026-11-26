# Changelog

Every release of Kaitech Mobile, newest first. Each version has one section, `## X.Y.Z - YYYY-MM-DD` (the day its tag was pushed, UTC), with the groups Added, Changed, Fixed and Known gaps; a group with nothing in it is left out. Every line names its pull request and task. The Release workflow copies the section into the body of the GitHub Release and stops a tag that has no section here. How to cut a release: [Releases](releases.md#cutting-a-release).

## 0.7.1 - 2026-11-26

Ships everything listed under 0.7.0, which was not published.

### Changed

- E2E: Android "Time to take action" is stretched to 30 s only in the chat cells, where the voice-note flow taps Undo after a discard; the rows cells keep the default Undo window they wait out (#121, ZHA-7842).

## 0.7.0 - 2026-11-26

Not published: Release run 45777800606 built every asset, but its rows cells failed because the E2E harness stretched every Undo bar to 30 s while the rows flows wait 15 s for it to commit. 0.7.1 ships these changes.

### Added

- Chat composer like WhatsApp in Kaitech colours: attach, the message field with an emoji/sticker/GIF button inside it, a camera button that hides while you type, and one button that is the microphone on an empty field and Send once there is text. The swaps animate on the UI thread, keep the row height, and respect Reduce motion (#106, ZHA-7842).
- Voice notes: hold the microphone to record, slide left to cancel, slide up to lock for hands-free, pause, play the draft, resume, send, or discard with Undo. Recordings under one second show a hint instead of sending; a call, the app going to the background or the 30-minute limit pauses the note into a draft that survives a restart. Playback can seek, change speed, resume where it stopped, mark unplayed notes and play the next one (#106, ZHA-7842).
- Emoji, sticker and GIF panel that replaces the keyboard at the keyboard's height, with search, recent and favourite stickers, and KLIPY stickers and GIFs fetched through the lab0 server (#106, ZHA-7842, ZHA-7807).
- Attach sheet with gallery, camera, document and audio; the camera opens after the Kaitech permission card and the photo is previewed before sending (#106, ZHA-7842).
- Setting "Tap to record" for people who cannot hold the button (#106, ZHA-7842).

### Fixed

- Chat: the session cookie is sent with sticker and GIF images only to the account's own server, and plain-http media from other hosts is not loaded (#106, ZHA-7842).

### Known gaps

- Meizu Mblu 21: recording and the attach menu still drop most frames, as before this release; the cost is the GPU time of the chat thread screen (12 to 25 ms per frame), not the composer (ZHA-7842).
- GIFs work on lab0 only until KLIPY confirms the server proxy in writing. Location, polls and contact cards in the attach sheet wait for a server contract; voice notes show a computed waveform until ZHA-7850's stored waveform is read (ZHA-7842).
- iOS: the composer, the voice-note module and the panel are not tested on an iPhone (ZHA-7277).
## 0.6.1 - 2026-11-26

### Changed

- Android: the tab bar and the floating action button are drawn in React Native instead of Jetpack Compose (`@expo/ui` removed), which brings cold start on the Meizu Mblu 21 back to about 1.2 s from about 1.5 s (#99, ZHA-7439).
- E2E: Android phone cells get a 4 GB emulator and record when adb loses the emulator; Maestro's driver port is pinned below the Android ephemeral range (#111, #117, ZHA-7851). Sign-in runs through a fresh Chrome (#113, ZHA-7882). The Coworker flows ask a real question instead of the text "undefined" (#114, ZHA-7439).
- E2E: the layout check fails when the chat composer ends less than 8 dp above the navigation bar; the merge gate is the required CI checks, the reviewer's approval and the changed journey on a physical phone (#109, ZHA-7854; #116, ZHA-7546).

### Fixed

- Bottom sheets, the chat composer and the MoM sheets keep their gap above the gesture pill and the three-button navigation bar instead of sitting on it, and add no extra space while the keyboard is open (#109, ZHA-7854).
- Android: the footer of sign-in and other form screens stays above the keyboard (#71, ZHA-7546).
- Chat: the thread no longer flickers when a message is sent or when the list is flung fast (#104, ZHA-7803).
- Calls: the app no longer crashes when a peer stops sharing their screen in a call (#105, ZHA-7832).

### Known gaps

- iOS below 26: the tab bar keeps its items on the home indicator edge, like UIKit; not checked on an iPhone (ZHA-7854).
- iOS: dialogs on screens that need a signed-in account are not yet proven on the simulator; that waits for iOS sign-in in CI (ZHA-7277, follow-up ZHA-7797).
## 0.6.0 - 2026-11-25

### Added

- Dialogs: every confirm, choice, text prompt and one-line message is drawn by the app in the Kaitech colours of the light or dark theme, the same on Android and iOS, instead of the system alert. Destructive confirms paint the confirm button red, a one-line message shows in the snackbar at the bottom, and the Android back button, a tap outside and Cancel all answer no (#101, ZHA-7789).
- Permissions: a card says what the camera, microphone or notifications are used for before the system prompt, and offers Settings when the system will not ask again (#101, ZHA-7789).

### Changed

- Lint rejects `Alert`, `ActionSheetIOS`, `ToastAndroid` and `Modal` from React Native in `src/`; a test fails for a native modal route that does not mount its own dialog layer (#101, ZHA-7789).
- E2E: `themed/dialogs.yaml` photographs the destructive confirm, the camera card and the snackbar in light and dark and asserts no system dialog is on screen (#101, ZHA-7789).

### Fixed

- CI: `maestro check-syntax` no longer races to unpack its dependencies when flows are checked in parallel (#101, ZHA-7789).

### Known gaps

- iOS: dialogs on screens that need a signed-in account are not yet proven on the simulator; that waits for iOS sign-in in CI (ZHA-7277, follow-up ZHA-7797).
- A snackbar raised while a dialog is open is drawn under the dialog's scrim.
- Still drawn by the system: the permission prompts, the photo, camera and file pickers, the share sheet, the biometric prompt of the app lock, the screen-capture consent and the sign-in browser tab.
- Calls: the app can crash when a peer stops sharing their screen in a group call (ZHA-7832).

## 0.5.3 - 2026-11-25

Not published: Release run 45588646628 built and checked every asset, but its last rows check waited behind other E2E runs after an emulator disconnect and a lab0 502 on the first attempt, so it was cancelled. 0.6.0, tagged after it, shipped these changes first.

### Fixed

- Chat: message bubbles are as wide as their text and at most 80% of the message lane on phones too, yours on the right and everyone else's on the left, like WhatsApp; a wrapped message used to fill the whole row because the 576 dp cap was wider than a phone. On tablets the lane stays centred at 720 dp, so the cap is still 576 dp (#103, ZHA-7809).

### Changed

- E2E: the rows cells post a short and a long message from each side of the test conversation, measure the bubbles against the lane, and delete them again (#103, ZHA-7809).
- E2E: group and channel calls are proved with two web peers on the phone en-US call cell (#88, ZHA-7721).
- E2E: a signed-in cell whose sign-in page never opens keeps a screenshot and the sign-in activity log (#97, ZHA-7771).

### Known gaps

- iOS: bubble widths are not verified on an iPhone or the simulator in this release (ZHA-7277).

## 0.5.2 - 2026-11-24

### Changed

- iOS: the Android-only `@expo/ui` is no longer linked into the iOS app, and the iOS JS bundle no longer carries its Compose views; the IPA is 1,705,526 bytes smaller than 0.5.0 (24623415 bytes), and the size baselines follow the trimmed build (#98, ZHA-7773).
- CI: the E2E `ios ipa size` job builds the release IPA and checks its size on pull requests that change native or bundler inputs or carry `measure-ios`, nightly and on full runs, so size growth shows in the pull request that caused it (#98, ZHA-7773).
- E2E: signed-in cells hold lab0 against a deploy while their flows run (#94, ZHA-7767).

### Fixed

- Chat: Mark as urgent is disabled once today's urgent quota is spent, as on the web, instead of leaving the message unsent (#93, ZHA-7439).
- E2E: the iOS simulator job runs again on macOS's bash 3.2; the lab0 hold from #94 stopped it before the first flow (#98, ZHA-7773).

## 0.5.1 - 2026-11-24

First published release with the changes of 0.5.0, which was tagged but never published: its Release run stopped at the iOS size gate.

### Changed

- Releases: the iOS IPA size baseline is the v0.5.0 measurement, 26328941 bytes; main had grown 14.9% over the old one before 0.5.0 (#96, ZHA-7730).

## 0.5.0 - 2026-11-24

Not published: Release run 45427529768 stopped at the iOS size gate (`ios.ipa_bytes` +15.1% on the old baseline, limit 15%), so no GitHub Release exists for this tag. These changes first shipped in 0.5.1.

### Added

- Android: Material 3 Expressive with the Kaitech seed: colour roles, navigation bar and rail, bottom sheets and controls (#50, ZHA-7471).
- iOS 26+: Liquid Glass tab bar, native form sheets and floating controls (#51, ZHA-7469).
- Chat: a Starred row lists starred messages and removes every star (#54, ZHA-7440).

### Changed

- Calls: one Call button; every call starts as voice and the camera and screen share are turned on inside it (#52, ZHA-7463).
- Chat, Discovery, MoM and Activity: one top bar with the title, Search and profile in a single row on Android and iOS; every pull to refresh shows its whole indicator (#90, ZHA-7730).
- Chat: sender names in the neutral ink colour and placeholder avatars in the web's six fills (#91, ZHA-7751).
- E2E: the signed-in cells use parallel test accounts and the call cells run next to the rows cells (#85, ZHA-7641; #86, ZHA-7463).
- E2E: the rows cells check the top bar, empty space and the pull-to-refresh indicator of every main tab (#90, ZHA-7730).
- Releases ship a changelog in `docs/changelog.md` and on the release page (#87, ZHA-7720).

### Fixed

- Rows: Undo hides as soon as its window closes and keeps the newer Undo when an earlier delete fails (#82, #84, ZHA-7439).
- Sheets (Android): sheet content stays within the window width (#89, ZHA-7439).
- E2E: iOS portrait cells skip the no-op rotation at flow start (#72, ZHA-7557).
- E2E: Android sign-in presses Enter again when the first press did not reach the database field, and types verbatim (#74, ZHA-7589; #81, ZHA-7629).
- E2E: flows wait for the closed form and the refreshed MoM board (#76, ZHA-7626; #77, ZHA-7628).
- E2E: the emulator and its system image install are retried until they unpack (#78, #79, ZHA-7631).
- E2E: the sign-in Custom Tab closes by its button and maestro-runner stays off Chrome DevTools (#80, ZHA-7633; #83, ZHA-7636).

### Known gaps

- E2E: the rows tablet cells fail on main when lab0 answers the Discovery panel with a server error (ZHA-7766).

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
