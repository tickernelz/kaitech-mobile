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
| `CI` (`ci.yml`) | push ke `main`, PR, manual | gitleaks seluruh riwayat dan pohon kerja; lint, typecheck, paritas kunci terjemahan, gerbang konfigurasi tablet, Jest; build APK, IPA, E2E emulator |
| `Build` (`build.yml`) | dipanggil CI dan Release | APK release x86_64 untuk E2E (setiap run) dan APK release universal empat ABI (hanya `main` dan tag), keduanya bertanda tangan dan diverifikasi sidik jari sertifikatnya; IPA tanpa tanda tangan (`xcodebuild`, runner macOS `xcode-27`), pindai rahasia di bundle JS, gerbang performa, E2E Maestro di emulator Android (ponsel dan tablet, portrait dan landscape, `en-US` dan `id-ID`, paralel), E2E APK universal di tag, rekaman dan screenshot per sel |
| `iPad trial` (`ipad-trial.yml`) | push ke `main`, tag `v*`, manual | percobaan simulator iPad `en-US`, di luar CI utama agar run CI tidak menunggu iPad; run baru pada ref yang sama membatalkan run lama |
| `Release` (`release.yml`) | tag `v*` | tolak tag yang tidak menunjuk commit di `main`, gitleaks, build, lalu GitHub Release berisi APK, IPA, dan `SHA256SUMS.txt` |
| `gitleaks push` (`gitleaks.yml`) | push ke cabang selain `main` dan setiap tag | gitleaks seluruh riwayat dan pohon kerja |

Artefak E2E hanya diunggah bila gitleaks bersih.

Artefak per run: `e2e-apk-x86_64` (APK yang diuji E2E), `kaitech-android-apk` (APK universal, hanya `main` dan tag), `kaitech-ios-ipa`, `perf-android-x86_64`, `perf-android-universal` dan `perf-ios` (angka gerbang performa), delapan `e2e-android-<ukuran>-<orientasi>-<locale>` (video, `screenshots/`, `display.txt`, JUnit, logcat, keluaran Maestro, `cold-start.txt` di sel ponsel portrait `en-US`). Run `iPad trial` mengunggah `e2e-ipad-en-US` (satu folder per sel, video `simctl`, `junit.xml`, keluaran Maestro, log konsol Maestro `maestro-console.log` (ditambah `maestro-console-attempt1.log` bila sel diulang), dan screenshot Maestro di `screenshots/`). Tag rilis menambah `e2e-android-universal-phone-portrait-en-US`.

### Jalur cepat dan cache

E2E Android hanya butuh APK x86_64, jadi job `android apk x86_64 (e2e)` membangun satu ABI dan sel E2E mulai begitu job itu selesai. APK yang dirilis tetap APK universal empat ABI dari job `android apk`, yang jalan paralel hanya di `main` dan tag; di PR job itu dilewati (status cek tetap lolos). Akibatnya, di PR kompilasi `arm64-v8a`, `armeabi-v7a`, dan `x86` baru terjadi setelah merge. Tag rilis menjalankan satu sel E2E (ponsel portrait `en-US`) atas APK universal sebelum GitHub Release dibuat.

Cache, semuanya ditulis hanya di luar `pull_request` (push ke `main`, tag, run manual) dan dibaca PR:

| Cache | Isi | Kunci |
|---|---|---|
| Gradle (`setup-gradle`) | dependensi, wrapper, build cache Gradle (`--build-cache`) | dikelola action |
| `ccache-android-<varian>-…` | hasil compile C/C++ NDK lewat `ccache` (`CMAKE_C*_COMPILER_LAUNCHER`) | hash `package-lock.json`, `app.json`, `app.config.ts` |
| `ios-downloads-…` | unduhan CocoaPods dan artefak prebuilt React Native/Hermes | hash yang sama |

Yang diukur lalu tidak dipakai: cache system image emulator dan snapshot AVD (memulihkannya selama mengunduh dan boot dingin, sementara ukurannya 3 sampai 5 GB dari kuota cache repo 10 GB), ccache iOS (React Native core dan modul Expo sudah prebuilt, jadi tidak ada panggilan compiler C yang bisa di-cache), dan image container prebuilt (yang bisa dimasukkan hanya Maestro dan gitleaks, sekitar 10 detik per job).

### Gerbang performa

`scripts/perf-gate.mjs` membandingkan angka setiap run dengan `perf/baseline.json` dan menggagalkan job bila satu angka naik melewati `maxIncrease`-nya:

| Angka | Diukur di job | Cara |
|---|---|---|
| `android.apk_x86_64_bytes`, `android.apk_universal_bytes` | `android apk x86_64 (e2e)`, `android apk` | ukuran berkas APK |
| `android.js_bundle_bytes` | kedua job APK | `assets/index.android.bundle` |
| `ios.ipa_bytes`, `ios.js_bundle_bytes` | `ios ipa (unsigned)` | ukuran IPA dan `main.jsbundle` |
| `android.cold_start_ms` | sel E2E ponsel portrait `en-US` | median `TotalTime` dari 5 kali `adb shell am start -W -S`, setelah satu peluncuran pemanasan |

Ambang ukuran 15 persen: di SHA yang sama ukurannya tidak berubah antar-run, jadi kenaikan berarti perubahan nyata. Ambang cold start 100 persen karena median antar-run di emulator runner bersama berbeda jauh (965 sampai 1641 ms di sembilan run, termasuk empat run di SHA yang sama), jadi gerbang ini hanya menangkap cold start yang naik sampai dua kali lipat; angkanya dan run sumbernya tercatat di `source` tiap entri. Perubahan yang memang disengaja memperbarui `perf/baseline.json` di PR yang sama, dengan alasan di deskripsi PR.

Rilis: `git tag v0.1.0 && git push origin v0.1.0`.

### Secret GitHub

| Secret | Wajib | Guna |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | untuk rilis | tanda tangan APK dengan keystore non-toko |
| `GOOGLE_SERVICES_JSON` | tidak | isi `google-services.json` (FCM). Tanpa secret ini build tetap hijau dan push Android mati. |

Nilai secret tidak pernah ditulis ke repo, log, atau artefak. Berkas kredensial ditolak `.gitignore`.

Secret scanning dan push protection GitHub aktif, jadi push yang berisi rahasia dikenal ditolak sebelum masuk. Action pihak ketiga wajib dipin ke SHA commit (aturan repo). PR dari fork berjalan tanpa secret (APK bertanda tangan kunci debug, push mati) dan harus disetujui pemilik repo sebelum workflow jalan. Token workflow default hanya baca. Workflow rilis hanya jalan dari tag di repo ini.

Jangan pernah menulis alamat server lab0 nyata, token, nama database, atau data nyata ke repo. Alamat server dibaca saat runtime dari isian pengguna di layar masuk; contoh dan fixture memakai data karangan.

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

### Bahasa (en dan id)

Semua teks yang tampil ke pengguna berasal dari katalog terjemahan, satu berkas per bahasa: `src/i18n/locales/en.json` dan `src/i18n/locales/id.json`. Katalog lain (misalnya teks izin OS) cukup diletakkan sebagai pasangan `en.json` dan `id.json` di folder mana pun di bawah `src/i18n/`.

Gerbang CI `npm run i18n:check` menggagalkan build bila dalam satu pasangan:

- ada kunci yang hilang atau berlebih di salah satu bahasa,
- ada nilai kosong atau bukan string,
- placeholder `{{nama}}` berbeda antarbahasa,
- salah satu berkas tidak ada.

Teks izin OS dan nama aplikasi per bahasa ada di `src/i18n/native/`, dipasang lewat `locales` di `app.json`. Lint (`i18next/no-literal-string`) menolak teks yang ditulis langsung di JSX, termasuk `label`, `title`, `placeholder`, dan `accessibilityLabel`.

Pustaka: `expo-localization` + `i18next` + `react-i18next`.

- `expo-localization` adalah modul Expo resmi untuk membaca bahasa perangkat; di Android bahasa perangkat bisa berubah tanpa restart, jadi dibaca ulang setiap aplikasi kembali aktif.
- `i18next` mengganti bahasa saat aplikasi berjalan (`changeLanguage`) dan `react-i18next` merender ulang layar yang memakainya, sehingga pilihan di Pengaturan berlaku tanpa restart. Plural dan interpolasi memakai `Intl` bawaan Hermes.
- Alternatif yang tidak dipakai: `i18n-js` tidak punya hook yang merender ulang komponen saat bahasa berganti; Lingui butuh macro Babel dan langkah kompilasi katalog.

Bahasa awal mengikuti perangkat (`id` atau `in` menjadi Indonesia, selain itu Inggris). Pilihan di Pengaturan (Bahasa perangkat, English, Bahasa Indonesia) disimpan di `expo-sqlite/kv-store` dan dibaca sinkron sebelum layar pertama, jadi tidak ada kedipan bahasa. Tanggal dan angka diformat lewat `useFormatters()` dengan `Intl` di bahasa terpilih. Galat dari server dibaca dari `error_code` yang stabil lalu diterjemahkan aplikasi (`src/auth/errors.ts`); kalimat dari server tidak pernah ditampilkan.

### Masuk (login)

Aplikasi membuka `/kaitech_mobile/authorize` di server yang diisi pengguna lewat browser sistem dengan PKCE S256, lalu menukar kode di `/kaitech_mobile/token`. Token perangkat disimpan di Keychain/Keystore (`expo-secure-store`, hanya perangkat ini, hanya saat terbuka); data akun yang bukan rahasia disimpan di `kv-store`. Kontrak server: README modul `kaitech_mobile` lab0.

Server mengembalikan kode ke App Link/Universal Link `https://<domain tautan>/kaitech_mobile/callback`; skema kustom tidak dipakai. Domain tautan dibaca saat build dari variabel `KAITECH_LINK_HOST` (bukan dari repo). Build tanpa variabel itu tetap jalan, tetapi layar masuk menampilkan pesan bahwa domain tautan belum diatur. Domain itu harus menyajikan `/.well-known/assetlinks.json` dengan sidik jari sertifikat di atas dan terdaftar di `kaitech_mobile.redirect_uris` server.

### Ikon dan splash

`node scripts/brand-assets.mjs` membuat ulang semua ikon dan gambar splash dari huruf K dan garis gradien logo Kaitech (butuh `inkscape`). Sumber SVG ada di `assets/brand/`. Warna latar splash sama dengan warna kanvas tema (terang `#FAF9FC`, gelap `#110B18`), jadi tidak ada kedipan putih saat JS mengambil alih. Font merek Plus Jakarta Sans (OFL, `assets/fonts/OFL.txt`) ditanam lewat plugin `expo-font`; teks isi memakai font sistem.

### E2E

Alur Maestro ada di `.maestro/`. Jalankan lokal di emulator yang sudah memasang APK:

```bash
maestro test .maestro
```

Di CI, setiap alur jalan dua kali, di emulator ber-locale `en-US` dan `id-ID`. `scripts/e2e-android.sh` mengganti locale sistem (`persist.sys.locale` lalu restart framework), menunggu sampai konfigurasi framework memakai locale itu, memasang APK release, merekam layar, lalu menjalankan semua alur dengan variabel `APP_LANGUAGE` (`en` atau `id`) untuk teks yang diperiksa, misalnya `${APP_LANGUAGE === 'id' ? 'Selamat datang' : 'Welcome'}`. Lebih disarankan memeriksa elemen lewat `testID`. Alur `sign-in-form` juga memutar layar ke orientasi lain dan kembali, lalu memeriksa isi kolom alamat server tidak hilang.

Jalankan lokal: `maestro test -e APP_LANGUAGE=id -e DEVICE_SIZE=phone -e ORIENTATION=portrait .maestro`. Ketiga variabel wajib dikirim lewat `-e`; jangan beri nilai bawaan di blok `env:` alur, karena nilai itu menimpa `-e`.

### Matriks perangkat

Superapp harus responsif di ponsel dan tablet, Android dan iOS, portrait dan landscape. Setiap sel Android adalah job tersendiri dengan emulatornya sendiri, jadi kedelapan sel jalan paralel.

| Platform | Ukuran | Perangkat | Lebar jendela portrait / landscape | Orientasi | Bahasa | Status |
|---|---|---|---|---|---|---|
| Android 15 (API 35) | `phone` | emulator profil `pixel_6` | 411 dp (compact) / 914 dp | portrait, landscape | `en-US`, `id-ID` | wajib hijau |
| Android 15 (API 35) | `tablet` | emulator profil `pixel_tablet` (10 inci) | 800 dp (medium) / 1280 dp (expanded) | portrait, landscape | `en-US`, `id-ID` | wajib hijau |
| iPadOS (runtime simulator terbaru di runner `xcode-27`) | `tablet` | simulator iPad Pro 13 inci (atau iPad lain bila tidak ada) | lihat `simulator.txt` | portrait, landscape | `en-US` | percobaan di workflow `iPad trial` (push `main`, tag, manual), tidak memblokir (`continue-on-error`); driver XCTest Maestro diberi waktu start 10 menit (`MAESTRO_DRIVER_STARTUP_TIMEOUT=600000`) dan sel diulang sekali hanya bila gagal dengan `IOSDriverTimeoutException` |

Orientasi Android diatur lewat `user_rotation` dengan memperhitungkan orientasi alami panel (tablet alami landscape); iPad memakai `setOrientation` Maestro di hook `onFlowStart` (`.maestro/shared/orientation.yaml`), karena runner XCTest Maestro mengembalikan simulator ke portrait setiap sesi baru. Setiap alur baru wajib memuat hook itu:

```yaml
onFlowStart:
  - runFlow: shared/orientation.yaml
```

Di Android hook itu tidak melakukan apa-apa. Ukuran panel, density, dan rotasi tiap sel dicatat di `display.txt`. Pemeriksaan status `e2e android en-US` dan `e2e android id-ID` di branch protection hijau hanya bila kedelapan sel Android hijau. Simulator iPad tidak butuh tanda tangan atau akun Apple; perangkat iPad asli belum diuji.

Screenshot dinamai `<layar>-<ukuran>-<orientasi>-<bahasa>.png`, misalnya `launch-tablet-landscape-id.png`, lewat subflow bersama:

```yaml
- runFlow:
    file: shared/screenshot.yaml
    env:
      SCREEN: launch
```

Semua screenshot sel disalin ke `screenshots/`. `scripts/check-screenshots.mjs` menggagalkan sel bila ada screenshot yang tidak mengikuti pola nama atau dimensinya tidak cocok dengan orientasi sel (misalnya layar terkunci portrait di sel landscape). Screenshot iOS disimpan dalam bingkai portrait dengan tag orientasi EXIF; pemeriksaan memakai dimensi setelah tag itu diterapkan. Alur di subfolder `.maestro/shared/` tidak dijalankan sendiri.

### Gerbang konfigurasi tablet

`node scripts/check-tablet-config.mjs` (langkah CI di job lint) gagal bila `orientation` bukan `default`, `ios.supportsTablet` bukan `true`, `ios.requireFullScreen` bernilai `true`, atau hasil `expo prebuild` mengunci `android:screenOrientation`, mematikan `android:resizeableActivity`, menyalakan `UIRequiresFullScreen`, atau tidak mendukung keempat orientasi iPad.

Alur masuk sampai keluar ada di `.maestro/signed-in/` dan tidak ikut `maestro test .maestro` di CI, karena butuh server, akun uji, dan build dengan `KAITECH_LINK_HOST`. Jalankan dengan `maestro test -e APP_LANGUAGE=id -e DEVICE_SIZE=phone -e ORIENTATION=portrait -e SERVER=<alamat> -e LOGIN=<akun> -e PASSWORD=<sandi> .maestro/signed-in`; nilainya jangan pernah ditulis ke repo, log, atau artefak publik.

## Lisensi

MIT, lihat `LICENSE`.
