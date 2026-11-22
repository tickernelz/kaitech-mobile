# Install the IPA (iOS)

Download `kaitech-<build>-<sha>-unsigned.ipa` from [Releases](https://github.com/tickernelz/kaitech-mobile/releases/latest) to a computer. The IPA is built without a signature because there is no Apple Developer account yet. iOS does not install an unsigned IPA, so re-sign it with a personal Apple ID:

- **AltStore**: install AltServer on the computer, install AltStore on the iPhone, then open the IPA through AltStore (My Apps, the + button).
- **Sideloadly**: connect the iPhone to the computer, drag the IPA into Sideloadly, sign in with the Apple ID, then Start.

With a free Apple ID the app is valid for 7 days and must be re-signed (AltStore can refresh it automatically). After installing, trust the developer profile in Settings > General > VPN & Device Management.

iOS limits without an Apple Developer account: without APNs, realtime updates only run while the app is active (websocket) and there are no background notifications. Features that need an Apple entitlement (VoIP push, full CallKit, Universal Links) are not verified yet.
