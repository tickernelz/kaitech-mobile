# App identity

| | Value |
|---|---|
| Android `applicationId` | `io.kaitech.mobile` |
| iOS bundle identifier | `io.kaitech.mobile` |
| SHA-256 fingerprint of the APK certificate | `26:A6:64:8C:98:D7:90:1D:F6:17:E3:CA:F2:B9:3D:78:0B:85:E7:79:0C:16:AA:44:30:82:50:2B:E5:3C:1C:50` |

The fingerprint is not a secret. Use this value in the server's `assetlinks.json` for Android App Links:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.kaitech.mobile",
    "sha256_cert_fingerprints": ["26:A6:64:8C:98:D7:90:1D:F6:17:E3:CA:F2:B9:3D:78:0B:85:E7:79:0C:16:AA:44:30:82:50:2B:E5:3C:1C:50"]
  }
}]
```

CI rejects an APK whose certificate does not match `.github/android-release-cert.sha256`.
