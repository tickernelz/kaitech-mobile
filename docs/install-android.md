# Install the APK (Android)

1. Download `kaitech-<build>-<sha>-arm64-v8a.apk` from [Releases](https://github.com/tickernelz/kaitech-mobile/releases/latest) directly on the phone, or download it on a computer and send it to the phone. If Android refuses to install it ("App not installed" or "incompatible"), the phone is not arm64-v8a: download `kaitech-<build>-<sha>.apk` (universal, four ABIs, larger). Both use the same keystore, so either can update the other. For a build of `main` between releases, run the `Release` workflow manually on `main`; its artifacts are `kaitech-android-apk-arm64-v8a` and `kaitech-android-apk`.
2. If it was not downloaded on the phone, send the file to the phone.
3. When the file is opened, Android asks for the "Install unknown apps" permission for the app that opens it (Files, Chrome). Allow it for that app only.
4. Install. Later builds can update the app directly because every build uses the same keystore.

An APK ending in `-debugkey` only appears when the keystore secret is not available (for example a PR from a fork). That APK cannot update the official APK; uninstall the old version first if you want to try it.

## Notifications

Messages, calls and reminders arrive through Firebase Cloud Messaging, also when Kaitech is closed or swiped away from recent apps (measured on a Meizu Mblu 21: about 1.2 s, see [Releases](releases.md#android-push-on-a-physical-phone-zha-7944)).

- Allow notifications when Kaitech asks, the first time you send a message. Later: Settings > Apps > Kaitech > Notifications.
- Never use Force stop (Settings > Apps > Kaitech > Force stop). Android then blocks every push to Kaitech, calls included, until you open Kaitech again. Swiping Kaitech away from recent apps is fine.
- If calls or messages arrive late on a phone with an aggressive battery saver (Xiaomi, Oppo, Vivo, Meizu and others), set Settings > Apps > Kaitech > Battery to Unrestricted (the name differs per maker: "No restrictions", "Allow background activity").
- With several accounts on one phone, only the account that is open in Kaitech receives notifications. Switch to an account to receive its notifications again.
- Answer and Decline work from the call notification and from the lock screen; Answer opens Kaitech and joins the call.
