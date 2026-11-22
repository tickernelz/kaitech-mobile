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
  segmentation and Core Image. Until the first mask arrives the whole frame is blurred. The choice is kept per device,
  like the web's local setting, and re-applied whenever LiveKit restarts the camera track (mute, flip). The processor API
  of the pinned `@livekit/react-native-webrtc` is internal (`_setVideoEffects`).
- Screen: `src/app/call/[id].tsx`, which renders `src/features/call/ui/CallScreen.tsx`. The in-app ring overlay
  for an incoming call is `CallRuntime` in the root layout, so it works on every screen and above the app lock.

Why this stack: `@livekit/react-native` is the client for the same LiveKit server Odoo already uses, so a phone and a
browser share one room; ringtone and full-screen ringing are Android platform behaviour with no stable Expo module,
so they live in our own small Kotlin module instead of Notifee (last release December 2024) or react-native-callkeep
(which wants the system dialer to own calls and fights LiveKit's audio session).

Incoming rings: while the app is in the foreground the invitation arrives on the Odoo bus and the app draws the
in-app ring; in the background, dead, or on the lock screen the FCM data ring starts the foreground service and the
CallStyle notification. Answering from the notification opens the app and joins. Declining sends
`/mail/rtc/channel/cancel_call_invitation`, through the app when it is alive and through a headless JS task when it
is not. iOS has the in-app ring only: VoIP push and CallKit need an Apple Developer account and entitlements the
unsigned build does not have, so there the app must be open to ring (marked unverified).

## Trying a call from this machine

`scripts/call-peer.mjs` joins a conversation as a browser peer (headless Chrome with a fake microphone and camera),
so the phone or emulator has somebody to call:

```bash
CALL_SERVER=lab0.example.com CALL_DB=lab0 CALL_LOGIN=peer CALL_PASSWORD=secret \
  CALL_CHANNEL_ID=145 node scripts/call-peer.mjs start
node scripts/call-peer.mjs leave
```

It prints the room, the peer session id and what the peer subscribed to, and keeps the peer in the call until `leave`.

The whole device check is one command once an emulator boots:

```bash
CALL_SERVER=… CALL_DB=… CALL_LOGIN=… CALL_PASSWORD=… CALL_CHANNEL_ID=… \
  SERVER=https://… LOGIN=… PASSWORD=… PEER='Uji Chat Web (ZHA-7238)' \
  bash scripts/e2e-call.sh dist/app-release.apk out emulator-5554 en-US phone portrait
```

It locks the orientation, installs the APK, records the screen, starts the browser peer, runs `.maestro/signed-in/call.yaml`, leaves the call, and drops the recording, the junit report, the screenshots and the app log in the output folder.
