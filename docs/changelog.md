# Changelog

Every release of Kaitech Mobile, newest first. Each version has one section, `## X.Y.Z - YYYY-MM-DD` (the day its tag was pushed, UTC), with the groups Added, Changed, Fixed and Known gaps; a group with nothing in it is left out. Every line names its pull request and task. The Release workflow copies the section into the body of the GitHub Release and stops a tag that has no section here. How to cut a release: [Releases](releases.md#cutting-a-release).

## 0.14.5 - 2026-11-28

### Fixed

- Chat and Coworker: on Android, while the attach sheet is open, TalkBack no longer reaches the conversation behind the dimmed area. The header, message list and message field are hidden from the screen reader until the sheet closes, and closing it, Back included, puts the screen reader back on the attach button. On the Meizu Mblu 21 the screen-reader tree with the sheet open dropped from 61 conversation items to none (#162, ZHA-8085).
- Chat: in landscape the attach sheet stops below the status bar and its contents scroll, so the first row (Gallery, Camera, Document, Location) is no longer cut off at the top (#162, ZHA-8085).

### Changed

- Developers: docs/e2e.md records the Mblu 21 frame budget (at most 7% late frames and a p99 of 30 ms per scenario) and the thread numbers it is based on (#161, ZHA-7969).

### Known gaps

- Android: returning the screen reader to the attach button is covered by tests but has not been tried with TalkBack switched on; the Mblu 21 is shared and TalkBack changes its gestures (#162, ZHA-8085).

## 0.14.4 - 2026-11-27

### Added

- Developers: `scripts/phone-jank.mjs` also measures scrolling a thread, opening and closing the emoji panel, and opening and closing a thread, and fails when a scenario does not end in the measured thread (#159, ZHA-7969).

### Changed

- Chat: on Android a conversation slides in from the right and back out, as in WhatsApp, instead of the system fade-and-stretch; nothing moves when reduced motion is on (#159, ZHA-7969).

### Fixed

- Chat: scrolling a conversation on Android no longer stutters. Message bubbles keep one corner radius and draw the small corner as a patch of their own colour, so the bubble shape is unchanged but Android no longer redraws each bubble on the CPU while the list moves. On the Meizu Mblu 21 late frames while scrolling dropped from 10.9% to 1.8% and the worst frame from 82 to 24 ms (#159, ZHA-7969).
- Chat: the emoji panel opens without a stall on its first frame. The emoji grid stays ready after the panel first opens, and the chat background no longer resizes while the panel or keyboard moves; reopening the panel reloads saved stickers and recent emoji and starts with an empty search. On the Mblu 21 late frames dropped from 13.2% to 5.9% and the worst frame from 93 to 24 ms (#159, ZHA-7969).
- Chat: opening and closing a conversation dropped from 11.1% to 6.6% late frames on the Mblu 21, and the attach sheet from 7.0% to 3.4% (#159, ZHA-7969).

### Known gaps

- On the Mblu 21 the emoji panel (5.6-5.9%) and opening and closing a conversation (6.6%) stay above the 5% late-frame target. This phone composes the taskbar, status bar and screen corners on the GPU every frame, so the app waits about 9 ms for a free buffer, and opening a conversation creates about 150 views at once (ZHA-7969).
- With the GIF tab as the last tab, the emoji panel rebuilds the GIF grid on every open, as before (ZHA-7969).

## 0.14.3 - 2026-11-27

### Added

- Developers: `scripts/phone-jank.mjs` measures late frames, p90 and p99 of the voice-note slide, the attach sheet and the locked recording on a physical phone, and fails above a limit (#140, ZHA-7946).

### Fixed

- Chat: holding the microphone anywhere on the button and sliding left now cancels the voice note on Android; before, starting on the right half of the button fired the system Back gesture, which paused the recording into a draft and closed the chat. Checked on the Meizu Mblu 21, whose right-edge gesture zone covers half of the button (#140, ZHA-7946).
- Chat and Coworker: on Android the attach sheet opens inside the screen instead of in a separate window, so its first frame no longer stalls, and Back closes the sheet without leaving the conversation. On the Mblu 21 the worst frame while opening and closing it dropped from 77-89 ms to 18-25 ms, and the share of late frames from 5.8-6.2% to 3.2-4.6% (#140, #157, ZHA-7946).

### Known gaps

- Android: the attach sheet has not been checked with TalkBack; without a separate window, focus may move to the conversation behind the dimmed area while it is open (#140, ZHA-7946).
- On the Mblu 21 the 90th-percentile frame time of the thread screen stays around 14-17 ms, above the 11.1 ms of a 90 Hz frame; the GPU takes 4-6 ms per frame, the rest is main-thread and render-thread work on this phone (ZHA-7946).

## 0.14.2 - 2026-11-27

### Fixed

- Calls: a person who answers but whose call takes more than about 16 seconds to connect is no longer hung up by the caller with "No answer" while the conversation records an answered call; the caller keeps ringing until the 45-second limit, and a person who never connects is still ended about 12 seconds after it (#155, ZHA-7966).

## 0.14.1 - 2026-11-27

### Fixed

- Calls: a call you place shows "Calling…", then "Ringing…" until someone else joins, and the clock starts at 00:00 when they do; before, it counted from the moment the phone reached the call room, so an unanswered call read 00:03, 00:11. A one-to-one or group call that nobody answers, or that the other side declines, ends with "No answer" (#129, ZHA-7966).
- Chat: a call nobody answered now reads "No answer" for the caller and "Missed call" for the people called, without a duration, and an answered call counts its minutes from the answer; before, an unanswered call of 15 seconds read "Call · 1 min". A call notice that arrives while the conversation is open updates when the call starts and ends, instead of keeping "Call" with no duration until the conversation is reopened. Needs `kaitech_mobile` 19.0.1.13.0 on the server (#129, ZHA-7966).

### Known gaps

- Android: the ongoing-call notification still counts from the moment the phone reached the call room, not from the answer (#129, ZHA-7966).

## 0.14.0 - 2026-11-28

### Added

- Calls: in a voice call held to the ear, the screen turns off and ignores touches, and turns on again when the phone moves away, like the phone app. It only happens while the call screen is open, nobody shows a camera or screen share, and the sound plays from the earpiece; the speaker, a Bluetooth or wired headset, picture-in-picture, the background or the end of the call keep the screen on. Checked on the Meizu Mblu 21: the proximity screen-off lock was held 1.4 s after answering, released 0.8 s after the other person turned a camera on and 0.2 s after choosing the speaker or hanging up, and taken back when the camera or speaker went off (#144, ZHA-7992).

### Fixed

- App lock: when signing out from the lock screen fails, the Sign out button stops spinning and the lock screen says so, instead of spinning forever (#149, ZHA-7439).

### Known gaps

- iOS: the screen-off at the ear is built and compiled, not checked on a device (#144, ZHA-7992).

## 0.13.0 - 2026-11-27

### Changed

- App icon and splash: the icon is now the kaitech.io favicon mark on Android (adaptive background, foreground and monochrome) and on iOS (any, dark and tinted, compiled from the Icon Composer stack), and the splash uses the same mark. The retired icon assets are gone (#146, ZHA-8004).
- Floating capsules in the light theme (tab bar, call controls, chat composer): the pale purple glass sat at 1.14:1 against the screen and its buttons at 1.14:1 against the capsule, so both blended into white. The glass colour is now a deeper lavender at a higher opacity from one token, at 1.33:1 against the screen and 1.26:1 for a button against the capsule, while every label and icon on it keeps its contrast over light and dark content. The dark theme is unchanged (#151, ZHA-8064).

### Fixed

- Chat composer: while typing, the emoji button sat about 3 dp from the end of the message capsule, almost against the send button; it now sits as far in as the attach button on the other end (14 dp from the edge) whether the field is empty, has text, or the emoji panel is open, and every button in the capsule is at least 48 dp. The send button takes the capsule's own shadow, so the two read as one row (#150, ZHA-8058).
- Chat: a "Call in progress" notice was almost twice as tall as an ended call's notice. Both are now the same pill; Join still takes a 48 dp touch without making the pill bigger (#150, ZHA-8058).
- Lists: a refresh indicator could stay up after the refresh finished because the native call that releases it ran before the view had mounted; it is retried until it takes effect (#145, ZHA-7439).

### Known gaps

- iOS: no device check. The iOS 26 icon stack is compiled and present in the release IPA, but the glass look behind sign-in has still not been seen (ZHA-7277). The IPA measures 26,751,577 bytes at 144a8b3, +8.6% on the 24,623,415 byte baseline (limit +15%); its JS bundle is 9,702,966 bytes, +5.9% on 9,159,155.

## 0.12.0 - 2026-11-27

### Changed

- Tab bar, call controls and the chat composer: all three are now floating glass capsules in Kaitech colours with a thin edge and a soft shadow, so they stand apart from a white or dark background instead of blending into it. iOS below 26 blurs what is behind them; Android uses a tinted glass without blur, because blur added about 3 ms per frame while scrolling on the Meizu Mblu 21. With Reduce Transparency or high contrast on they turn solid (#141, ZHA-7978).
- Chat composer: it floats over the conversation with no bar behind it, so the messages scroll up to the bottom edge and the last message still ends above the capsule. Attach, emoji, camera and the text line now sit on one centre line with the send button (#141, ZHA-7978).
- Larger pills: the tab bar is 68 dp tall instead of 64, the composer 52 dp instead of 44, and call buttons 56 dp instead of 52, from one shared size set; on phones narrower than 360 dp the five call buttons shrink to fit, never below 44 dp (#141, ZHA-7978).

### Known gaps

- Opening and closing the keyboard in a conversation measured about 1.8 ms more per frame at the 90th percentile on the Meizu Mblu 21 (34.3 against 32.5 ms, 6 alternating rounds), about 1 to 2 extra janky frames per keyboard open; the floating composer was kept by choice. Typing, scrolling, tab switches and cold start were not worse (#141, ZHA-7978).
- iOS: no device check. Unit tests cover the iOS below 26 blur capsule and the Release IPA builds (+0.05%); the iOS 26 Liquid Glass look behind sign-in has not been seen (ZHA-7277).

## 0.11.0 - 2026-11-27

### Added

- Chat: swipe a message right to reply to it, like WhatsApp; a short swipe, swiping back, or a cancelled gesture does not reply, and deleted messages and system notices cannot be swiped. Long-pressing a message, sending, and adding a reaction now vibrate. Dragging a voice note's waveform still seeks instead of swiping the message (#131, ZHA-7967).
- App lock: a phone with only a screen PIN (no fingerprint enrolled) can now turn app lock on; before, Settings showed no app lock at all on such a phone (#110, ZHA-7439).

### Changed

- Chat: the format bar (bold, italic, code, link, quote, list) appears only while text is selected, so typing keeps the full thread height; all six actions fit on a 411 dp screen. The thread title gets about 207 dp instead of 163 dp, so "Uji Chat Web (ZHA-7238)" fits without being cut. Measured on the Meizu Mblu 21 (#131, ZHA-7967).

### Fixed

- App lock: when the device's screen lock was removed while app lock was on, every unlock failed and only clearing app data helped; the lock screen now says why and offers sign-out behind a confirm (#139, ZHA-7439).
- Lists: data invalidated while it was still loading (for example the MoM list right after an upload finished) is refetched at once instead of showing the older answer until the stale timer ran out (#115, ZHA-7439).

### Known gaps

- Chat scroll on the Meizu Mblu 21 measured 28.8% janky frames with swipe-to-reply against 27.2% without (slow UI thread 1557 against 1561, 3 alternating rounds on the 0.9.0 base); the gap sits inside the per-pass spread but is not proven regression-free (#131, ZHA-7967).
- iOS: swipe-to-reply against the iOS back gesture has no device check; the changes are shared code covered by unit tests (#131, ZHA-7967).

## 0.10.3 - 2026-11-27

### Fixed

- Chat: a wide table in a message can be scrolled sideways on Android, so you can reach its last column. Before, the long press on the message held every finger movement and the table never scrolled. Holding a table still opens the message actions. Measured on the Meizu Mblu 21 with a six-column table: scroll position stayed at 0 on 0.10.2, and reached 252 after a drag and 485 (the last column) after a fling on this build (#142, ZHA-7977).

### Known gaps

- iOS: no device check; the change is shared code covered by unit tests (ZHA-7977).

## 0.10.2 - 2026-11-27

### Fixed

- Touch targets: every control a finger can tap now takes at least 44 by 44 dp. A settings row with a switch (Tap to record, Out of office, Picture in picture, App lock and the others) flips when you tap anywhere on the row, and a screen reader hears it as one switch. Filter chips in Chat, Search and Activity, GIF chips, emoji categories, reaction pills, voice note controls and the other small controls keep their look but accept taps up to 44 dp, without taking taps meant for the control next to them. Measured on the Meizu Mblu 21: taps 2.9 to 4.6 dp outside a chip's drawn edge selected it in 0 of 5 cases on 0.8.0 and 5 of 5 on this build; tapping a switch row's text flipped the switch in 0 of 3 cases before and 3 of 3 after (#133, ZHA-7965).
- Existing controls that took taps from a neighbour no longer do: the composer's emoji/keyboard button (2 dp of the text field), the format bar's hide button (4 dp of the last format action), the media and PDF viewer bar buttons (4 dp of each other) and the poll option remove button (8 dp of its field) (#133, ZHA-7965).
- Files: the detail line of a PDF or file card takes two lines instead of cutting off, and a long file name breaks after `_`, `-` or `.` instead of inside a word (#133, ZHA-7965).

### Changed

- A message with reactions or a thread link is 8 dp taller, wrapped rows of reactions are 12 dp apart, and the emoji category row and the GIF chip row each have 4 dp more space below, so the taps below a pill or chip stay with it (#133, ZHA-7965).

### Known gaps

- The composer text field measures 43.4 dp (the 44 dp field minus its 1 px border), and on screens narrower than 396 dp each emoji category is the panel width divided by nine, under 44 dp (#133, ZHA-7965).
- iOS: no device check; the changes are shared code covered by unit tests (ZHA-7965).

## 0.10.1 - 2026-11-27

### Fixed

- Launch: on Android a cold start no longer shows an empty light screen for about 0.4 s between the splash and the first screen, in the dark and the light theme. The splash now stays until the first screen has laid out and leaves without a fade on Android, and the account's saved theme applies before the first frame. Measured on the Meizu Mblu 21 (15 recordings each, the same 0.8.0 native build with the old and the new JS): empty light frames in 15 of 15 cold starts before, in 0 of 15 after. A cold start opens the Chat list; reopening the app while it still runs returns to the screen you left, as before (#132, ZHA-7964).

### Known gaps

- Launch, measured on the Mblu 21: the Chat list shows a median 1790 ms after the splash appears against 1681 ms before, with overlapping ranges (1484-1883 and 1550-1892 ms); the cause of the difference is not proven. `am start -W` TotalTime rises from a median 1495 to 2002 ms because the first frame drawn is now the Chat list instead of the empty screen (#132, ZHA-7964).
- Launch: with the phone in the light theme and the account set to Dark, 3 of 8 cold starts still show 2 to 3 light splash frames (45-65 ms) right after the Chat list first appears; fixing it needs the account's night mode applied natively before the activity starts (ZHA-7964).

## 0.10.0 - 2026-11-26

### Changed

- Tabs: on phones the tabs sit in a capsule that floats at the bottom of the screen, slightly see-through, with its own look per platform on the Kaitech colours. Android follows Material 3 Expressive: the selected tab opens into a wide slot with its label beside the filled icon, and the indicator stretches while it slides to the next tab and squeezes while a tab is held. iOS below 26 follows the iOS 26 system bar: equal slots with labels under the icons and a lens that slides between tabs. iOS 26 and later keep the system Liquid Glass bar. Tablets keep the side rail (#125, ZHA-7950).
- Tabs: switching tabs gives a light haptic, the Activity badge pops when it appears or its number changes, and the incoming tab screen fades in on the background colour, so nothing flashes white. Reduce Motion turns every animation into an instant change; Reduce Transparency, Increase Contrast and Android high contrast text make the capsule solid. While the keyboard is up the capsule slides away (#125, ZHA-7950).
- Chat, Discovery, MoM and both Activity lists end with room for the floating capsule, and the New chat button and the undo bar sit above it (#125, ZHA-7950).

### Known gaps

- Tabs, measured on the Meizu Mblu 21 against 0.9.0: scrolling and cold start are unchanged, and the worst frame on a tab switch drops from 46-150 ms to 34-38 ms, but each switch now animates about 65 frames instead of jumping in about 9, so about 3 more frames per switch arrive late (88-119 against 31-41 over 20 switches). Neither build meets the ZHA-7946 jank target for tab switches (#125, ZHA-7950).
- iOS: no device. The capsule for iOS below 26 is covered only by unit tests, CI simulators run iOS 26 (the unchanged system bar), and the Liquid Glass bar behind sign-in has not been seen (ZHA-7950, ZHA-7277).

## 0.9.0 - 2026-11-26

### Added

- Chat: polls. Poll in the attach sheet asks a question with 2 to 12 options and an "allow more than one answer" switch. The bubble shows each option with its count and a bar; tapping votes, changes or takes back a vote at once and puts it back when the server refuses (a closed poll, offline). View votes lists who chose what, and the author can close the poll. Every device updates live (#123, ZHA-7807).
- Chat: locations. Location in the attach sheet asks through the Kaitech permission card first, then opens a full-screen OpenStreetMap map drawn by the app (no map SDK or key; tiles come through the lab0 server) to send the current position, a point under the pin, or a search result. The bubble shows a map preview with the place name or address and opens a full map with Open in maps app (#123, ZHA-7807).
- Chat: live location for 15 minutes, 1 hour or 8 hours. Android keeps sending through a foreground service with a notification and a Stop button; the phone posts a new point after moving 20 m or every 2 minutes, the server ends the share when its time is up, and signing out stops it. Measured on the Meizu Mblu 21: about 28 mAh an hour (0.6% of the battery per hour) with the screen off (#123, ZHA-7807).
- Chat: the conversation list, reply quotes and Android notifications show short labels for polls, locations, live locations, stickers and GIFs (#123, ZHA-7807).

### Changed

- Chat: stickers and GIFs in a conversation play only while their bubble is on screen and the app is in front; a GIF plays as a short silent video (video cache capped at 100 MB). A long press on a poll or location opens the message actions, and a pack sticker in a conversation can be added to favourites (#123, ZHA-7807).
- Chat: cached messages keep polls and locations in a field older builds ignore, so installing an older build over this one does not crash on them (#123, ZHA-7807).

### Known gaps

- iOS: live location sends only while Kaitech is open, and polls, locations and live location have not run on an iPhone (ZHA-7807, ZHA-7277).
- Live location uses high GPS accuracy, like WhatsApp; a battery-saving mode is not offered (ZHA-7807).

## 0.8.2 - 2026-11-26

### Fixed

- MoM and Discovery tell empty, failed and offline apart. Offline with nothing loaded shows "No connection" instead of the empty text ("Belum ada rekaman rapat"), a failed load shows the error with Retry, and data already on screen gets a banner saying it is what was loaded last; both tabs reload once when the connection returns (#130, ZHA-7968).
- Chat: in landscape on a phone the New button sits in the app bar instead of floating over the conversation rows; in portrait the list ends with room for the button (#130, ZHA-7968).
- Large text (font scale 1.5 and up): the Chat filter chips wrap instead of being cut off, the attach sheet shows two sources per row so "Dokumen" fits, and the thread title may take two lines (#130, ZHA-7968).

### Changed

- iOS build: `EXPO_MODULES_SCAN_TIMEOUT_MS` sets the Expo module scan timeout (default 5000 ms) through `patches/expo-modules-autolinking+58.1.0.patch`, after a Release build failed when the scan timed out; no app code changed (#124, ZHA-7945).
- Docs: reminder push measured on the Meizu Mblu 21 (#128, ZHA-7944).

## 0.8.1 - 2026-11-26

### Fixed

- Calls: Answer on the incoming-call notification opens Kaitech and joins the call. Until now it did nothing while the phone kept ringing, because Android 12 and later do not let a notification broadcast open an app (#126, ZHA-7944).
- Chat: opening a conversation from a notification after several messages arrived while Kaitech was closed shows the newest message instead of stopping at the last one already on the phone (#126, ZHA-7944).

### Changed

- E2E: `scripts/push-latency.mjs` and the phone flows `.maestro/local/push-message-open.yaml` and `push-call-answer.yaml` measure and repeat Android push on a physical phone; the results on the Meizu Mblu 21 are in [Releases](releases.md#android-push-on-a-physical-phone-zha-7944) (#126, ZHA-7944).
- E2E: the chat fling check fails on half-empty frames (#119, ZHA-7919).

### Known gaps

- Android blocks every push, calls included, to an app the user force-stopped in Settings until it is opened again; [Install the APK](install-android.md#notifications) says so (ZHA-7944).
- Push after hours of Doze, battery use, and phones other than the Meizu Mblu 21 are not measured (ZHA-7944).

## 0.8.0 - 2026-11-26

### Added

- Chat: photos, videos, PDFs and other files preview like WhatsApp. A photo tile keeps its real shape and opens a full-screen viewer with pinch and double-tap zoom; a video shows its first frame, length and a play button and starts playing at once in the viewer; a PDF card shows its first page, page count and size and opens an in-app reader; other files show an icon per kind with a download control (progress with cancel, retry after a failure, share when done). The viewer swipes across every picture and video of the conversation, shares, and saves to the gallery. The same applies to threads, groups, channels and Coworker replies (#102, ZHA-7804).

### Changed

- Downloaded media, previews and their sizes are kept per account under the app cache and removed when the account is forgotten (#102, ZHA-7804).
- E2E: `signed-in/chat-media.yaml` sends a photo, a video, a PDF and a document and checks every preview, the video playing, the swipe, the PDF reader and the document download, inside the message it sent and after clearing a leftover voice draft; it passed on the Meizu Mblu 21 (#102, ZHA-7804).

### Known gaps

- iOS: the media viewer, video playback and PDF reader compile in the IPA job but have not run on an iPhone or the simulator (ZHA-7804).

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
