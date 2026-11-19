# Kaitech Mobile

Aplikasi mobile Kaitech untuk Android dan iOS, dibangun dengan React Native dan Expo SDK 58 (development build, bukan Expo Go). APK dan IPA hanya dibangun di GitHub Actions, tanpa EAS Build.

Alamat server dan database diisi pengguna saat masuk. Repo ini tidak menyimpan alamat server, kunci, atau token apa pun.

## Identitas aplikasi

| | Nilai |
|---|---|
| Android `applicationId` | `io.kaitech.mobile` |
| iOS bundle identifier | `io.kaitech.mobile` |
| Sidik jari SHA-256 sertifikat APK | `26:A6:64:8C:98:D7:90:1D:F6:17:E3:CA:F2:B9:3D:78:0B:85:E7:79:0C:16:AA:44:30:82:50:2B:E5:3C:1C:50` |

Sidik jari itu bukan rahasia. Pakai nilai ini di `assetlinks.json` server untuk Android App Links:

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

CI menolak APK yang sertifikatnya tidak cocok dengan `.github/android-release-cert.sha256`.

## Pasang APK (Android)

1. Buka run CI yang hijau di tab Actions (atau halaman Releases), unduh artefak `kaitech-android-apk`, lalu ekstrak zip-nya.
2. Kirim berkas `kaitech-<build>-<sha>.apk` ke ponsel.
3. Saat membuka berkas, Android meminta izin "Pasang aplikasi tak dikenal" untuk aplikasi pembuka (Files, Chrome). Izinkan untuk aplikasi itu saja.
4. Pasang. Build berikutnya bisa langsung memperbarui aplikasi karena semua build memakai keystore yang sama.

APK berakhiran `-debugkey` hanya muncul bila secret keystore tidak tersedia (misalnya PR dari fork). APK itu tidak bisa memperbarui APK resmi; hapus dulu versi lama bila ingin mencobanya.

## Pasang IPA (iOS)

IPA dibangun tanpa tanda tangan karena belum ada akun Apple Developer. iOS tidak mau memasang IPA tanpa tanda tangan, jadi tanda tangani ulang dengan Apple ID pribadi:

- **AltStore**: pasang AltServer di komputer, pasang AltStore ke iPhone, lalu buka IPA lewat AltStore (My Apps, tombol +).
- **Sideloadly**: sambungkan iPhone ke komputer, seret IPA ke Sideloadly, masuk dengan Apple ID, lalu Start.

Dengan Apple ID gratis, aplikasi berlaku 7 hari dan harus ditandatangani ulang (AltStore bisa memperbaruinya otomatis). Setelah memasang, percayai profil pengembang di Pengaturan > Umum > VPN & Manajemen Perangkat.

Batas iOS tanpa akun Apple Developer: tanpa APNs, pembaruan realtime hanya berjalan saat aplikasi aktif (websocket) dan tidak ada notifikasi latar. Fitur yang butuh entitlement Apple (VoIP push, CallKit penuh, Universal Links) belum terverifikasi.

## Ditunda sampai ada akun Google Play dan Apple Developer

- Google Play Console: unggah ke toko, Play internal testing, Play App Signing.
- Apple: TestFlight, App Store, profil provisioning, sertifikat distribusi.
- APNs (notifikasi iOS) dan VoIP push (PushKit).
- CallKit yang memakai entitlement push VoIP.
- Universal Links iOS yang terverifikasi (`apple-app-site-association` dengan Team ID).

## CI

| Workflow | Pemicu | Isi |
|---|---|---|
| `CI` (`ci.yml`) | push ke `main`, PR, manual | gitleaks seluruh riwayat dan pohon kerja; lint, typecheck, Jest; build APK, IPA, E2E emulator |
| `Build` (`build.yml`) | dipanggil CI dan Release | APK release (Gradle, runner Linux), IPA tanpa tanda tangan (`xcodebuild`, runner macOS `xcode-27`), pindai rahasia di bundle JS, E2E Maestro di emulator Android dengan rekaman layar |
| `Release` (`release.yml`) | tag `v*` | gitleaks, build, lalu GitHub Release berisi APK, IPA, dan `SHA256SUMS.txt` |

Artefak per run: `kaitech-android-apk`, `kaitech-ios-ipa`, `e2e-android-recording` (video `e2e-android.mp4`, screenshot Maestro, JUnit, logcat).

Rilis: `git tag v0.1.0 && git push origin v0.1.0`.

### Secret GitHub

| Secret | Wajib | Guna |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | untuk rilis | tanda tangan APK dengan keystore non-toko |
| `GOOGLE_SERVICES_JSON` | tidak | isi `google-services.json` (FCM). Tanpa secret ini build tetap hijau dan push Android mati. |

Nilai secret tidak pernah ditulis ke repo, log, atau artefak. Berkas kredensial ditolak `.gitignore`.

## Pengembangan

Butuh Node 24 (`.nvmrc`). Folder `android/` dan `ios/` dibuat oleh `npx expo prebuild` dan tidak masuk repo; ubah perilaku native lewat `app.json`, `app.config.ts`, dan config plugin.

```bash
npm ci
npm run lint
npm run typecheck
npm test
npx expo run:android   # development build di emulator atau perangkat
npm start              # Metro untuk development build
```

Tambah paket dengan `npx expo install <paket>` supaya versinya cocok dengan SDK.

### E2E

Alur Maestro ada di `.maestro/`. Jalankan lokal di emulator yang sudah memasang APK:

```bash
maestro test .maestro
```

Di CI, `scripts/e2e-android.sh` memasang APK release, merekam layar, menjalankan semua alur, lalu menyimpan hasilnya sebagai artefak.

## Lisensi

MIT, lihat `LICENSE`.
