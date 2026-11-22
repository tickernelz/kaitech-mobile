Kaitech test release for the team, not a store release.

- **Android**: install `kaitech-<build>-<sha>-arm64-v8a.apk` (almost every Android phone today); if Android refuses to install it, install `kaitech-<build>-<sha>.apk` (universal, larger). Both are signed with the same non-store keystore as earlier releases, so they can update an installed app.
- **iOS**: `kaitech-<build>-<sha>-unsigned.ipa` is unsigned; re-sign it with AltStore or Sideloadly using a personal Apple ID. Sign-in through a Universal Link, APNs, VoIP push, and CallKit need an Apple Developer account and are not verified yet.
- Check the download: `sha256sum -c --ignore-missing SHA256SUMS.txt`.

How to install, what is proven on the emulator (size, orientation, language), and what is not yet: [docs/releases.md](https://github.com/tickernelz/kaitech-mobile/blob/main/docs/releases.md).
