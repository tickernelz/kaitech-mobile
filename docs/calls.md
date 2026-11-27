# Calls

Calls run on LiveKit, the server side of which lives in the `kaitech_mobile` Odoo addon (`README.md` there
holds the wire contract: `POST /kaitech_mobile/call/join`, the Discuss routes for ping, mute and leave, and the
ring push). The app holds the LiveKit room in `src/features/call/call.ts`, outside every screen, so rotation,
split-screen, fold/unfold and moving between screens never reconnects a call or asks for permissions again.

- `src/features/call/api.ts` speaks to Odoo: join, ping, session update, leave, decline.
- `src/features/call/odoo.ts` parses the store payloads (invitations, sessions, the caller behind a session).
- `src/features/call/grid.ts` decides the video grid, the pagination and where the controls and people list go,
  from the window size, never from the device model.
- `src/features/call/native.ts` wraps the local Expo module `modules/kaitech-call`, Android only: the ringing
  notification (CallStyle, full-screen intent, a looping ringtone in a foreground service), the ongoing call
  notification, picture-in-picture, and the channel that turns an FCM data ring into an in-app invitation.
- `src/features/call/blur.ts` turns the background blur of the local camera on and off through the local Expo module
  `modules/kaitech-video-effects`, which registers a frame processor with `@livekit/react-native-webrtc`
  (`ProcessorProvider` on Android, `LKRNProcessorProvider` on iOS). Android segments the person with the MediaPipe selfie
  segmenter model (`kaitech_selfie_segmenter.tflite`, 249 KB, Apache-2.0, from `storage.googleapis.com/mediapipe-models`)
  run by TensorFlow Lite from Google Play services ten times a second on a worker thread, and blurs and blends the I420
  planes in `BackgroundBlur.java`. ML Kit Selfie Segmentation was measured first and dropped: its runtime
  (`libxeno_native.so`) added 11.9 MB to the x86_64 APK (57.3 to 69.2 MB, over the 15 percent size gate), while the Play
  services runtime adds under 1 MB. Phones without Play services do not offer the blur. iOS uses Vision person
  segmentation and Core Image. Nothing is loaded at app start: the model and runtime load the first time a call uses the
  blur. The blur fails closed: until the first mask arrives, when segmentation fails, or when the model cannot load, the
  whole frame is blurred, and a frame the processor cannot read is sent black. The blur state turns off when the camera
  track no longer takes the effect, so the call screen never shows blur on a sharp camera. The choice is kept per device,
  like the web's local setting, and re-applied whenever LiveKit restarts the camera track (mute, flip).
  `@livekit/react-native-webrtc` is pinned to `150.2.0` because the processor API is internal (`_setVideoEffects`).
  Measured on the Mblu 21: 23 ms per frame at 960x540 with blur on; the peer received the same 9 to 10 fps as without
  blur, and WebRTC lowered the sent resolution from 720x1280 to 540x960.
- Screen: `src/app/call/[id].tsx`, which renders `src/features/call/ui/CallScreen.tsx`. The in-app ring overlay
  for an incoming call is `CallRuntime` in the root layout, so it works on every screen and above the app lock.

Why this stack: `@livekit/react-native` is the client for the same LiveKit server Odoo already uses, so a phone and a
browser share one room; ringtone and full-screen ringing are Android platform behaviour with no stable Expo module,
so they live in our own small Kotlin module instead of Notifee (last release December 2024) or react-native-callkeep
(which wants the system dialer to own calls and fights LiveKit's audio session).

Incoming rings: while the app is in the foreground the invitation arrives on the Odoo bus and the app draws the
in-app ring; in the background, dead, or on the lock screen the FCM data ring starts the foreground service and the
CallStyle notification. Answering from the notification opens the app and joins: the Answer action is an activity PendingIntent, because Android 12 and later forbid starting an activity from a notification broadcast (up to v0.8.0 it was a broadcast and did nothing, ZHA-7944). Declining sends
`/mail/rtc/channel/cancel_call_invitation`, through the app when it is alive and through a headless JS task when it
is not. iOS has the in-app ring only: VoIP push and CallKit need an Apple Developer account and entitlements the
unsigned build does not have, so there the app must be open to ring (marked unverified).

## Calls with more people

Every conversation type (direct chat, group, channel) has one LiveKit room, and the call button shows in all three (`ThreadView.tsx`). Who rings differs, and that is Odoo core, not the app: `discuss.channel._should_invite_members_to_join_call` invites the other members only when the first person joins and only when the conversation is not a channel. A group rings the other members; a channel rings nobody, so members join from the "Call in progress" notice in the thread (`MessageBubble.tsx`, `call-notice-<id>-join`) or the call button. That notice is the same pill as an ended call's notice, one footnote line high; Join reaches 48 dp to touch through padding cancelled by a negative margin, inside a call-notice row that is 48 dp tall for both (ZHA-8058). Call notices that follow each other on one day collapse into the newest (`src/features/chat/threadRows.ts`); until ZHA-7721 the oldest stayed, so a second call that day showed the first call's ended notice and no Join.

Until someone else is in the LiveKit room, a call the user placed is not "connected": the call screen and the call banner show "Calling…" until Odoo sends the invitation on the bus (`invited_member_ids` ADD for the conversation), then "Ringing…", and "Waiting for others…" in a channel, which rings nobody. The clock (`CallState.startedAt`) starts at 00:00 when the first remote participant connects, or at once when the user joins a call others are already in. Up to v0.8.0 it started when the phone itself reached the room, so an unanswered call counted 00:03, 00:11 (ZHA-7966). A direct chat or group call ends with "No answer" (`endedReason: 'unanswered'`) when every invitation is withdrawn (the other side declined, or Odoo web gave up after its 30 s ring) and a ping 4 s later shows no other session, or 45 s after the phone reached the room with nobody else in it. A check the server does not answer, or that finds another person's session whose participant never reached the room, is repeated every 4 s, three more times at most, and then the call ends the same way. The 4 s pause exists because Odoo withdraws the invitation of a person who answers in the same request that adds their session, before their LiveKit participant arrives. The Android ongoing-call notification still counts from the moment the phone reached the room: its chronometer is set in native code (`CallNotifications.kt`), which this change did not touch.

Whether a call was answered is recorded on the server: `kaitech_mobile` adds `discuss.call.history.kaitech_answered_dt` (lab0 MR for ZHA-7966), set when a second RTC session joins the open call and sent with every call notice. A notice whose call ended with that field empty reads "Missed call" for the people called and "No answer" for the caller, without a duration; an answered call's minutes count from `kaitech_answered_dt`, like the call clock, not from the first ring. A server without the field, and histories from before it (the migration fills them with `start_dt`), keep the plain "Call · n min" label.

Limits:

- lab0 LiveKit (`livekit-server` 1.13.11, `/etc/livekit/livekit.yaml`, read 24 November 2026) sets `room.max_participants: 50`, so one call holds at most 50 people. The `kaitech_mobile` addon adds no cap of its own. The media ports are one UDP range for all rooms on the box (`rtc.port_range_start` 50000 to `port_range_end` 50199); how many people that serves at once was not measured.
- The grid (`src/features/call/grid.ts`) puts 1 to 6 people on one page (up to 2 x 3), then 3 x 3; phones narrower than 400 dp stay at 2 x 3 in portrait. The seventh person on such a phone, or the tenth elsewhere, starts a second page; the active speaker is swapped onto the current page.

What CI proves, on the phone `en-US` call cell (`.maestro/signed-in/call-many.yaml`, after `call.yaml`): two web peers wait in the group `KAITECH_E2E_GROUP_CALL_ID` and two in the channel `KAITECH_E2E_CHANNEL_CALL_ID`, all with the camera off. In the group, the first peer joins, the phone rings in the app, the second peer joins, and the phone answers into a call that already holds both (a `join` step in `call-peer-command.js` returns only once that peer's LiveKit room reports it connected): the grid has three tiles and "People in the call" three rows; then one peer turns its camera on and the other shares a screen, and the camera tile, the shared screen with its "<name>'s screen" label and the people strip show; both stop again before the phone hangs up, because the call controls fade while remote video plays. Before that, the second peer stops and restarts its share six more times while the phone shows it (seven stops in all): stopping a shown remote share crashed the app natively in about one run in six with a single stop (ZHA-7832, see "Android WebRTC renderer patch" below), and on fde6ac8 without the patch seven stops crashed it on the first; the loop adds about 3 minutes to the call job. The labels and test ids of the screen stage show even when no frame is drawn, so `scripts/check-screen-share.mjs` fails the job unless `m5-group-peer-screen` (first share) and `m5-group-peer-screen-again` (after the last restart) show at least 2% of the peer's purple canvas (#441D65): 22.5% when the stage draws the share, 0% when it is black. Both are taken 3 s after the label shows, because the 1280x720 share's first frame lands up to about 1.1 s after the stage mounts (run 45589494023) and a screenshot inside that gap is black. In the channel, both peers join, the phone gets no ring, opens the channel from the Chat list, joins from the call notice and again sees three people. The first peer is the call cell's usual peer (the phone user of account 0); the second is the web user of account 1, who is signed in on no phone, so its ring reaches no device.

Fixed server race (ZHA-7759, `kaitech_mobile` 19.0.1.10.0 on lab0, 24 November 2026): when the last two people left at the same moment, Odoo core (`discuss.channel.rtc.session.unlink`) ran both leaves in parallel REPEATABLE READ transactions, each still saw the other's session, and neither closed the call history, so the thread kept a "Call in progress" notice with Join for a call that had ended (5 of 6 such calls on lab0 before the fix). The addon now serializes the last leave on the conversation row, and its migration closed the old open histories. The CI peers still leave one after another (`call-peer.mjs leave` and `POST /leave` answer only once the peer has left), and the channel step asserts exactly one Join.

Not tested on a device: calls with more than three people, the second grid page, the tablet and landscape layouts of a group call, and the iOS ring (iOS has the in-app ring only, see above).

## Android WebRTC renderer patch

`patches/@livekit+react-native-webrtc+150.2.0.patch` (ZHA-7832). Upstream `WebRTCView` draws `stream.videoTracks.get(0)`, the `VideoTrack` wrapper owned by the remote `MediaStream`. When a peer stops publishing, `setRemoteDescription` on the WebRTC signaling thread calls `MediaStream.removeVideoTrack` -> `VideoTrack.dispose()`, which frees every sink of that wrapper, while the view, which just got `streamURL=''`, calls `removeSink` for the same sink on the module executor. `VideoTrack.sinks` is a plain `IdentityHashMap` (`io.github.webrtc-sdk:android-prefixed:150.7871.04`), so both threads can free the same native sink and the app dies in `VideoTrack.nativeFreeSink` (E2E run 45557673136).

The patch makes the view draw, for a remote stream, the receiver's wrapper of the same native track from `PeerConnectionObserver.remoteTracks` (`WebRTCModule.getVideoTrackForRenderer`; local streams are unchanged). That wrapper is created in `onAddTrack` on the executor and disposed only by `peerConnection.dispose()`, also on the executor, so adding, removing and freeing the view's sinks happen on one thread. LiveKit reuses the receiver for every new share of a peer, so each share resolves to the same wrapper; a stream track without a receiver track logs `No receiver video track` and draws nothing. iOS is not patched: its renderer has no shared sink map.

On every bump of `@livekit/react-native-webrtc`, `patch-package` fails at install when the patched lines moved; check whether upstream `WebRTCView` still draws the stream's own wrapper before carrying the patch over, and rerun the group-channel call job.

## Trying a call from this machine

`scripts/call-peer.mjs` joins a conversation as a browser peer (headless Chrome with a fake microphone and camera),
so the phone or emulator has somebody to call:

```bash
CALL_SERVER=lab0.example.com CALL_DB=lab0 CALL_LOGIN=peer CALL_PASSWORD=secret \
  CALL_CHANNEL_ID=145 node scripts/call-peer.mjs start
node scripts/call-peer.mjs leave
```

It prints the room, the peer session id and what the peer subscribed to, and keeps the peer in the call until `leave`.

`CALL_PEERS=<n>` starts `n` peers in the same conversation, one after another, so peer 1 is the caller: peer `k` signs in with `CALL_LOGIN_<k>` and `CALL_PASSWORD_<k>` (peer 1 with `CALL_LOGIN` and `CALL_PASSWORD`), listens on `CALL_PEER_PORT + k - 1` and keeps its state next to `CALL_PEER_STATE` with a `-<k>` suffix. `leave`, `stop` and `logs` act on all of them; `live <k>` and `screen on|off <k>` on one. With `CALL_PEER_JOIN=command` a peer signs in and opens its page but joins only on `POST /join` to its port (answered at once; the outcome goes to the peer log), so a flow decides when the phone rings; `POST /leave` leaves the call and answers once it has, and `POST /command` with `{"camera": true}` or `{"share": true}` turns the camera or a drawn screen share on. Maestro flows send these through `.maestro/scripts/call-peer-command.js` (`PEER_PORT`, `PEER_ACTION`, `CAMERA`, `SHARE`).

The whole device check is one command once an emulator boots:

```bash
CALL_SERVER=… CALL_DB=… CALL_LOGIN=… CALL_PASSWORD=… CALL_CHANNEL_ID=… \
  SERVER=https://… LOGIN=… PASSWORD=… PEER='Uji Chat Web (ZHA-7238)' \
  bash scripts/e2e-call.sh dist/app-release.apk out emulator-5554 en-US phone portrait
```

It locks the orientation, installs the APK, records the screen, starts the browser peer, runs `.maestro/signed-in/call.yaml`, leaves the call, and drops the recording, the junit report, the screenshots and the app log in the output folder.
