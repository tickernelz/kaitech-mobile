# Kaitech Mobile

Aplikasi mobile Kaitech untuk Android dan iOS, dibangun dengan React Native dan Expo SDK 58 (development build, bukan Expo Go). APK dan IPA hanya dibangun di GitHub Actions, tanpa EAS Build.

Tombol Masuk langsung membuka halaman masuk server bawaan tanpa isian; server lain bisa dipilih lewat "Gunakan server lain". Repo ini tidak menyimpan alamat server, kunci, atau token apa pun. Server dan basis data bawaan di build rilis diisi dari variabel repo saat build (lihat [Masuk](#masuk-login)).

## Rilis

Unduh dari [Releases](https://github.com/tickernelz/kaitech-mobile/releases/latest): `kaitech-<build>-<sha>-arm64-v8a.apk` untuk Android (hampir semua ponsel Android sekarang; `kaitech-<build>-<sha>.apk` universal untuk ponsel lain), `kaitech-<build>-<sha>-unsigned.ipa` untuk iOS, dan `SHA256SUMS.txt`. Periksa unduhan dengan `sha256sum -c --ignore-missing SHA256SUMS.txt`. Ini rilis uji untuk tim, bukan rilis toko.

Mulai v0.2.3 tombol Masuk langsung membuka halaman masuk lab0 tanpa isian; server lain tetap bisa dipilih lewat "Gunakan server lain". Masuk di Android memakai App Link di domain tautan `lab0.kaitech.io` (variabel repo `KAITECH_LINK_HOST`), tertanam di build rilis mulai v0.2.2. Build tanpa variabel itu, misalnya PR dari fork, memberi tahu di layar masuk bahwa domain tautan belum diatur.

Push Android lewat FCM ikut build rilis mulai v0.2.2 (secret `GOOGLE_SERVICES_JSON`); build tanpa secret itu tidak punya push, dan catatan rilisnya menyebutnya.

Batas build rilis selama akun Apple Developer belum ada:

- **iOS.** Lihat [Pasang IPA](#pasang-ipa-ios): masuk lewat Universal Link, APNs, VoIP push, dan CallKit butuh akun Apple Developer.

### Yang terbukti

Semua bukti dari emulator Android atau simulator iPad; belum ada uji di perangkat fisik. Angka dan rekaman dari emulator berlaku untuk emulator.

| Bagian | Platform dan ukuran | Orientasi | Bahasa | Bukti |
|---|---|---|---|---|
| Pasang APK dari Release di emulator bersih, layar sambutan, tombol Masuk membuka halaman masuk lab0 tanpa isian, form "Gunakan server lain" memeriksa alamat dan basis data lalu kembali ke bawaan; di ponsel juga rotasi di tengah form tanpa kehilangan isian | Android 15 ponsel (`pixel_6`) dan tablet 10 inci (`pixel_tablet`) | portrait, landscape | en, id | job `install from release` di run Release tiap tag, rekaman `e2e-android-release-*` |
| Alur yang sama dengan APK x86_64 | Android 15 ponsel dan tablet | portrait, landscape | en, id | CI tiap push `main`, rekaman `e2e-android-*` |
| Alur yang sama di iPad (percobaan, tidak memblokir) | simulator iPad di runner macOS | portrait, landscape | en | workflow `iPad trial`; hasil per tag ada di run `iPad trial` tag itu |
| Masuk ke lab0 dari APK CI lewat App Link `lab0.kaitech.io` yang diverifikasi Android sendiri (`pm get-app-links`: verified), dari layar sambutan sampai Chat terbuka | Android 15 ponsel (`pixel_6`) | portrait | en | rekaman lokal APK CI, tidak dipublikasikan (tracker internal ZHA-7373) |
| Masuk ke server lalu keluar (F0) | Android ponsel dan tablet | tidak dicatat | en, id | rekaman lokal dengan build yang membawa domain tautan, tidak dipublikasikan (tracker internal ZHA-7236) |
| Chat: daftar, thread, antrean kirim offline, lampiran, pesan suara, dua panel di tablet (F1) | Android ponsel dan tablet | portrait, landscape | en, id | rekaman lokal (ZHA-7238) |
| Panggilan suara dua arah ponsel ke web, dering CallStyle dengan foreground service, landscape, picture-in-picture (F2) | Android ponsel | portrait, landscape | tidak dicatat | rekaman lokal (ZHA-7240) |
| Discovery: beranda Program, Coworker, kartu keputusan, bukti, Aktivitas, cari (F3) | Android ponsel dan tablet | portrait, landscape | en, id | rekaman 8 sel lokal (ZHA-7242) |
| MoM: rekam 22 menit dengan layar mati, unggah lanjut setelah proses dimatikan dan di uplink 256 kbit/s, notulen dan butir (F4) | Android ponsel dan tablet | portrait, landscape | en, id | rekaman 8 sel lokal (ZHA-7243) |

### Belum terverifikasi

- iPhone: IPA dibangun di CI, tetapi belum ada uji UI di simulator iPhone atau iPhone asli. iPad asli juga belum diuji.
- Split-screen Android, Split View dan Slide Over iPad, perangkat lipat, skala font sistem 200%, dan keyboard fisik di tablet. Konfigurasinya diperiksa (orientasi bebas, multi-window aktif, `UIRequiresFullScreen` mati) di APK dan IPA rilis, tetapi perilakunya belum diuji.
- Masuk di iOS, APNs, VoIP push, CallKit, Universal Link iOS, rekam MoM di latar dan unggah di iOS: butuh akun Apple Developer.
- Live Activity: belum dibangun; pembaruannya dari server butuh APNs.
- Push Android sampai ke perangkat, termasuk dering saat aplikasi mati dan Tolak dari notifikasi saat aplikasi mati: Firebase sudah ada di build rilis mulai v0.2.2, uji kirimnya belum.
- Layar kunci sungguhan (emulator tanpa keyguard) dan pemakaian baterai.
- Discovery di iPad: hanya diuji di emulator Android.
- MoM di ponsel landscape: sekali tercatat "recording couldn't start" di emulator dan belum terulang; galat native-nya kini masuk logcat bila muncul lagi.

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

1. Unduh `kaitech-<build>-<sha>-arm64-v8a.apk` dari [Releases](https://github.com/tickernelz/kaitech-mobile/releases/latest) langsung di ponsel, atau unduh di komputer lalu kirim ke ponsel. Bila Android menolak memasangnya ("Aplikasi tidak terpasang" atau "tidak kompatibel"), ponsel itu bukan arm64-v8a: unduh `kaitech-<build>-<sha>.apk` (universal, empat ABI, lebih besar). Keduanya memakai keystore yang sama, jadi saling bisa memperbarui. Build `main` di antara rilis ada sebagai artefak `kaitech-android-apk-arm64-v8a` dan `kaitech-android-apk` di run CI yang hijau.
2. Bila tidak diunduh langsung, kirim berkas itu ke ponsel.
3. Saat membuka berkas, Android meminta izin "Pasang aplikasi tak dikenal" untuk aplikasi pembuka (Files, Chrome). Izinkan untuk aplikasi itu saja.
4. Pasang. Build berikutnya bisa langsung memperbarui aplikasi karena semua build memakai keystore yang sama.

APK berakhiran `-debugkey` hanya muncul bila secret keystore tidak tersedia (misalnya PR dari fork). APK itu tidak bisa memperbarui APK resmi; hapus dulu versi lama bila ingin mencobanya.

## Pasang IPA (iOS)

Unduh `kaitech-<build>-<sha>-unsigned.ipa` dari [Releases](https://github.com/tickernelz/kaitech-mobile/releases/latest) ke komputer. IPA dibangun tanpa tanda tangan karena belum ada akun Apple Developer. iOS tidak mau memasang IPA tanpa tanda tangan, jadi tanda tangani ulang dengan Apple ID pribadi:

- **AltStore**: pasang AltServer di komputer, pasang AltStore ke iPhone, lalu buka IPA lewat AltStore (My Apps, tombol +).
- **Sideloadly**: sambungkan iPhone ke komputer, seret IPA ke Sideloadly, masuk dengan Apple ID, lalu Start.

Dengan Apple ID gratis, aplikasi berlaku 7 hari dan harus ditandatangani ulang (AltStore bisa memperbaruinya otomatis). Setelah memasang, percayai profil pengembang di Pengaturan > Umum > VPN & Manajemen Perangkat.

Batas iOS tanpa akun Apple Developer: tanpa APNs, pembaruan realtime hanya berjalan saat aplikasi aktif (websocket) dan tidak ada notifikasi latar. Fitur yang butuh entitlement Apple (VoIP push, CallKit penuh, Universal Links) belum terverifikasi.

## Ditunda sampai ada akun Google Play dan Apple Developer

- Google Play Console: unggah ke toko, Play internal testing, Play App Signing.
- Apple: TestFlight, App Store, profil provisioning, sertifikat distribusi.
- APNs (notifikasi iOS) dan VoIP push (PushKit).
- CallKit yang memakai entitlement push VoIP.
- Universal Links iOS yang terverifikasi (`apple-app-site-association` dengan Team ID), yang dibutuhkan untuk masuk di iOS.
- Live Activity untuk panggilan dan rekaman MoM.

## Calls

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

### Trying a call from this machine

`scripts/call-peer.mjs` joins a conversation as a browser peer (headless Chrome with a fake microphone and camera),
so the phone or emulator has somebody to call:

```bash
CALL_SERVER=lab0.example.com CALL_DB=lab0 CALL_LOGIN=peer CALL_PASSWORD=secret \
  CALL_CHANNEL_ID=145 node scripts/call-peer.mjs start
node scripts/call-peer.mjs leave
```

It prints the room, the peer session id and what the peer subscribed to, and keeps the peer in the call until `leave`.

## CI

| Workflow | Pemicu | Isi |
|---|---|---|
| `CI` (`ci.yml`) | push ke `main`, PR, manual | gitleaks seluruh riwayat dan pohon kerja; lint, typecheck, paritas kunci terjemahan, gerbang konfigurasi tablet, Jest; build APK, IPA, E2E emulator |
| `Build` (`build.yml`) | dipanggil CI dan Release | APK release x86_64 untuk E2E (setiap run) serta APK release universal empat ABI dan APK release `arm64-v8a` (hanya `main`, tag, dan run manual), semuanya bertanda tangan dan diverifikasi sidik jari sertifikatnya dan dicek isi `lib/<abi>`-nya; IPA tanpa tanda tangan (`xcodebuild`, runner macOS `xcode-27`), pindai rahasia di bundle JS, gerbang performa, E2E Maestro di emulator Android (ponsel dan tablet, portrait dan landscape, `en-US` dan `id-ID`, paralel), E2E APK universal di tag, rekaman dan screenshot per sel |
| `iPad trial` (`ipad-trial.yml`) | push ke `main`, tag `v*`, manual | percobaan simulator iPad `en-US`, di luar CI utama agar run CI tidak menunggu iPad; run baru pada ref yang sama membatalkan run lama |
| `Release` (`release.yml`) | tag `v*` | tolak tag yang tidak menunjuk commit di `main`, gitleaks seluruh riwayat, build, lalu draf GitHub Release berisi APK, IPA, dan `SHA256SUMS.txt`. APK dan IPA diunduh kembali dari draf itu: checksum, konfigurasi rotasi, multi-window, dan iPad di dalam berkasnya (`scripts/check-release-artifacts.py`), gitleaks atas isi APK dan IPA yang dibongkar, lalu APK dipasang di emulator baru (tanpa snapshot) di kedelapan sel ponsel dan tablet. Release baru dibuka bila semuanya lolos; run ulang setelah gagal memakai draf yang sama |
| `gitleaks push` (`gitleaks.yml`) | push ke cabang selain `main` dan setiap tag | gitleaks seluruh riwayat dan pohon kerja |

Artefak E2E hanya diunggah bila gitleaks bersih.

Artefak per run: `e2e-apk-x86_64` (APK yang diuji E2E), `kaitech-android-apk` (APK universal) dan `kaitech-android-apk-arm64-v8a` (APK `arm64-v8a`), keduanya hanya `main`, tag, dan run manual, `kaitech-ios-ipa`, `perf-android-x86_64`, `perf-android-universal`, `perf-android-arm64-v8a` dan `perf-ios` (angka gerbang performa), delapan `e2e-android-<ukuran>-<orientasi>-<locale>` (video, `screenshots/`, `display.txt`, JUnit, logcat, keluaran Maestro, `cold-start.txt` di sel ponsel portrait `en-US`). Run `iPad trial` mengunggah `e2e-ipad-en-US` (satu folder per sel, video `simctl`, `junit.xml`, keluaran Maestro, log konsol Maestro `maestro-console.log` (ditambah `maestro-console-attempt1.log` bila sel diulang), dan screenshot Maestro di `screenshots/`). Tag rilis menambah `e2e-android-universal-phone-portrait-en-US` dan delapan `e2e-android-release-<ukuran>-<orientasi>-<locale>` (APK yang diunduh dari draf Release, disimpan 90 hari).

### Jalur cepat dan cache

E2E Android hanya butuh APK x86_64, jadi job `android apk x86_64 (e2e)` membangun satu ABI dan sel E2E mulai begitu job itu selesai. APK yang dirilis adalah APK universal empat ABI dari job `android apk` dan APK `arm64-v8a` dari job `android apk arm64-v8a`; keduanya jalan paralel hanya di `main`, tag, dan run manual (`workflow_dispatch`, untuk mengukur ukuran sebelum merge); di PR kedua job itu dilewati (status cek tetap lolos). Akibatnya, di PR kompilasi `arm64-v8a`, `armeabi-v7a`, dan `x86` baru terjadi setelah merge. Tag rilis menjalankan satu sel E2E (ponsel portrait `en-US`) atas APK universal sebelum GitHub Release dibuat. Emulator runner berarsitektur x86_64, jadi APK `arm64-v8a` dibuktikan lewat cek ABI (isi `lib/` hanya `arm64-v8a`), sertifikat, dan checksum yang sama dengan berkas di Release, bukan lewat pemasangan.

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
| `android.apk_x86_64_bytes`, `android.apk_universal_bytes`, `android.apk_arm64-v8a_bytes` | `android apk x86_64 (e2e)`, `android apk`, `android apk arm64-v8a` | ukuran berkas APK |
| `android.js_bundle_bytes` | setiap job APK | `assets/index.android.bundle` |
| `ios.ipa_bytes`, `ios.js_bundle_bytes` | `ios ipa (unsigned)` | ukuran IPA dan `main.jsbundle` |
| `android.cold_start_ms` | sel E2E ponsel portrait `en-US` | median `TotalTime` dari 5 kali `adb shell am start -W -S`, setelah satu peluncuran pemanasan |

Ambang ukuran 15 persen: di SHA yang sama ukurannya tidak berubah antar-run, jadi kenaikan berarti perubahan nyata. Ambang cold start 100 persen karena median antar-run di emulator runner bersama berbeda jauh (965 sampai 1641 ms di sembilan run, termasuk empat run di SHA yang sama), jadi gerbang ini hanya menangkap cold start yang naik sampai dua kali lipat; angkanya dan run sumbernya tercatat di `source` tiap entri. Perubahan yang memang disengaja memperbarui `perf/baseline.json` di PR yang sama, dengan alasan di deskripsi PR.

Rilis: naikkan `version` di `app.json` lewat PR, lalu setelah merge `git tag v<versi> && git push origin v<versi>` di commit `main` itu.

### Secret GitHub

| Secret | Wajib | Guna |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | untuk rilis | tanda tangan APK dengan keystore non-toko |
| `GOOGLE_SERVICES_JSON` | tidak | isi `google-services.json` (FCM). Tanpa secret ini build tetap hijau dan push Android mati. |

Nilai secret tidak pernah ditulis ke repo, log, atau artefak. Berkas kredensial ditolak `.gitignore`.

Secret scanning dan push protection GitHub aktif, jadi push yang berisi rahasia dikenal ditolak sebelum masuk. Action pihak ketiga wajib dipin ke SHA commit (aturan repo). PR dari fork berjalan tanpa secret (APK bertanda tangan kunci debug, push mati) dan harus disetujui pemilik repo sebelum workflow jalan. Token workflow default hanya baca. Workflow rilis hanya jalan dari tag di repo ini.

Jangan pernah menulis alamat server lab0 nyata, token, nama database, atau data nyata ke repo. Server bawaan datang dari variabel repo saat build, server lain dari isian pengguna; contoh dan fixture memakai data karangan.

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

Pustaka: `expo-localization` + `i18next` + `react-i18next`. Teks Chat ada di namespace `chat` (`src/i18n/chat/en.json`, `id.json`), dipanggil dengan `useTranslation('chat')`.

- `expo-localization` adalah modul Expo resmi untuk membaca bahasa perangkat; di Android bahasa perangkat bisa berubah tanpa restart, jadi dibaca ulang setiap aplikasi kembali aktif.
- `i18next` mengganti bahasa saat aplikasi berjalan (`changeLanguage`) dan `react-i18next` merender ulang layar yang memakainya, sehingga pilihan di Pengaturan berlaku tanpa restart. Plural dan interpolasi memakai `Intl` bawaan Hermes.
- Alternatif yang tidak dipakai: `i18n-js` tidak punya hook yang merender ulang komponen saat bahasa berganti; Lingui butuh macro Babel dan langkah kompilasi katalog.

Bahasa awal mengikuti perangkat (`id` atau `in` menjadi Indonesia, selain itu Inggris). Pilihan di Pengaturan (Bahasa perangkat, English, Bahasa Indonesia) disimpan di `expo-sqlite/kv-store` dan dibaca sinkron sebelum layar pertama, jadi tidak ada kedipan bahasa. Tanggal dan angka diformat lewat `useFormatters()` dengan `Intl` di bahasa terpilih. Galat dari server dibaca dari `error_code` yang stabil lalu diterjemahkan aplikasi (`src/auth/errors.ts`); kalimat dari server tidak pernah ditampilkan.

### Masuk (login)

Tombol Masuk di layar sambutan langsung membuka server bawaan: alamatnya domain tautan (`KAITECH_LINK_HOST`, `lab0.kaitech.io`) dan basis datanya variabel repo `KAITECH_DEFAULT_DB` (`lab0`, bukan rahasia), keduanya dibaca saat build. "Gunakan server lain" di layar sambutan dan di Tambah akun dari Pengaturan membuka isian alamat server dan basis data; alamat server wajib, basis data boleh kosong untuk server satu basis data, dan keduanya diperiksa bentuknya sebelum browser dibuka, dan "Gunakan lab0.kaitech.io" kembali ke bawaan. Basis data yang tidak ada tidak bisa dikenali sebelum browser terbuka, karena `/web/login?db=<nama>` selalu menjawab 200. Build tanpa salah satu variabel tidak punya server bawaan: tombol Masuk membuka isian seperti di atas. Akun disimpan per server dan basis data (`u{uid}_hash(origin|db)`), jadi akun bawaan dan akun server lain tidak saling menimpa.

Aplikasi membuka `/kaitech_mobile/authorize` di server terpilih lewat browser sistem dengan PKCE S256, lalu menukar kode di `/kaitech_mobile/token`. Token perangkat disimpan di Keychain/Keystore (`expo-secure-store`, hanya perangkat ini, hanya saat terbuka); data akun yang bukan rahasia disimpan di `kv-store`. Kontrak server: README modul `kaitech_mobile` lab0.

Server mengembalikan kode ke App Link/Universal Link `https://<domain tautan>/kaitech_mobile/callback`; skema kustom tidak dipakai. Domain tautan dibaca saat build dari variabel `KAITECH_LINK_HOST` (bukan dari repo); nilainya `lab0.kaitech.io`, jadi nama host itu terlihat di APK dan IPA publik. Build tanpa variabel itu tetap jalan, tetapi layar masuk menampilkan pesan bahwa domain tautan belum diatur. Domain itu harus menyajikan `/.well-known/assetlinks.json` dengan sidik jari sertifikat di atas dan terdaftar di `kaitech_mobile.redirect_uris` server; lab0 memenuhi keduanya (parameter itu kosong, jadi server memakai `web.base.url` + `/kaitech_mobile/callback`). Server lain yang dimasukkan pengguna tetap mengembalikan kode ke domain tautan ini, jadi server itu harus mendaftarkan `https://lab0.kaitech.io/kaitech_mobile/callback` di `kaitech_mobile.redirect_uris`.

### Ikon dan splash

`node scripts/brand-assets.mjs` membuat ulang semua ikon, ikon kecil notifikasi Android, dan gambar splash dari huruf K dan garis gradien logo Kaitech (butuh `inkscape`). Ikon di dalam aplikasi digambar sendiri dan hanya ada di `src/ui/icons` (komponen `Icon`, varian `line` dan `fill`); `node scripts/icon-sheet.mjs <out.png>` membuat contact sheet seluruh set di 16/20/24/32 px, terang dan gelap. Sumber SVG ada di `assets/brand/`. Warna latar splash sama dengan warna kanvas tema (terang `#FAF9FC`, gelap `#110B18`), jadi tidak ada kedipan putih saat JS mengambil alih. Font merek Plus Jakarta Sans (OFL, `assets/fonts/OFL.txt`) ditanam lewat plugin `expo-font`; teks isi memakai font sistem.

### E2E

Alur Maestro ada di `.maestro/`. Jalankan lokal di emulator yang sudah memasang APK:

```bash
maestro test .maestro
```

Di CI, setiap alur jalan dua kali, di emulator ber-locale `en-US` dan `id-ID`. `scripts/e2e-android.sh` mengganti locale sistem (`persist.sys.locale` lalu restart framework), menunggu sampai konfigurasi framework memakai locale itu, memasang APK release, merekam layar, lalu menjalankan semua alur dengan variabel `APP_LANGUAGE` (`en` atau `id`) untuk teks yang diperiksa, misalnya `${APP_LANGUAGE === 'id' ? 'Selamat datang' : 'Welcome'}`. Lebih disarankan memeriksa elemen lewat `testID`. Alur `sign-in-form` membuka halaman masuk lab0 dari tombol Masuk tanpa isian, lalu lewat "Gunakan server lain" memeriksa alamat kosong atau tanpa https dan nama basis data yang salah, memutar layar ke orientasi lain dan kembali tanpa kehilangan isi kolom, dan kembali ke bawaan.

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

Alur masuk sampai keluar ada di `.maestro/signed-in/` dan tidak ikut `maestro test .maestro` di CI, karena butuh akun uji dan build dengan `KAITECH_LINK_HOST` dan `KAITECH_DEFAULT_DB`; alur ini masuk ke server bawaan. Jalankan dengan `maestro test -e APP_LANGUAGE=id -e DEVICE_SIZE=phone -e ORIENTATION=portrait -e LOGIN=<akun> -e PASSWORD=<sandi> .maestro/signed-in`; nilainya jangan pernah ditulis ke repo, log, atau artefak publik.

Alur `signed-in/discovery.yaml` masuk bila perlu, lalu membuka beranda Program, temuan dan buktinya, bertanya ke Coworker (di ponsel Android layar diputar di tengah mengetik untuk membuktikan draf tetap ada), kartu keputusan bila ada yang menunggu, cari gabungan, dan Aktivitas. Variabel tambahan: `-e QUESTION=<pertanyaan> -e SEARCH=<kata>`. Jalankan hanya dengan akun uji yang hanya menjadi anggota Program uji; rekaman memuat isi Program.

### Klien server (`src/api`)

`bearer()` memanggil rute `/kaitech_mobile/*` dengan token perangkat. `rpc()` memanggil metode model Odoo lewat `/web/dataset/call_kw` memakai sesi dari `POST /kaitech_mobile/session`: sesi disimpan di memori per akun, diperbarui semenit sebelum habis atau sekali saat server menjawab sesi kedaluwarsa, dan dikirim sebagai cookie `session_id` dengan `credentials: 'omit'` supaya jar cookie bawaan tidak ikut. Konteks `lang` mengikuti bahasa aplikasi, jadi label buatan server (status, judul agenda) tampil dalam bahasa yang sama. Galat server dipetakan ke kode stabil (`error_code` rute, atau `forbidden`, `not_found`, `refused`, `server` dari exception Odoo); teks penggunanya ada di katalog. Token 401 menandai sesi berakhir. `useResource()` menyimpan hasil per akun di memori, menyegarkan saat layar kembali fokus bila sudah basi, dan dikosongkan saat akun keluar.

### Discovery (`src/features/discovery`)

Semua baca memakai metode yang sama dengan layar web (`chat_contexts`, `programme_panel`, `fetch_transcript`, `read_packets`, `briefing_for_me`, `search_read` pada `ck.evidence`, `ck.finding`, `ck.finding.side`), jadi aturan akses Odoo yang menentukan isi. Tulis hanya lewat `/kaitech_mobile/discovery/ask` (kunci idempoten per pertanyaan, kirim ulang memakai kunci yang sama) dan `/discovery/answer` (setuju atau bukan pada kartu yang menunggu konfirmasi orang); HP tidak membuat kartu. Jawaban Coworker tampil apa adanya; langkah alatnya dilipat jadi satu baris. Transkrip dibaca ulang tiap 2,5 detik hanya selama giliran masih berjalan, layar fokus, dan aplikasi aktif. Draf pertanyaan disimpan per Program dan percakapan di luar pohon layar, jadi tidak hilang saat rotasi atau ganti ukuran jendela, dan dihapus saat akun keluar.

Di jendela expanded (840 dp ke atas) beranda Program dan utas Coworker tampil berdampingan, temuan di kiri dan buktinya di kanan, kartu dari notifikasi di kanan dengan kartu terbuka lain di kiri. `routeForPush()` memetakan push `discovery_card`, `discovery_card_restated`, dan `discovery_answer` ke layar kartu atau utas.

### Chat (`src/features/chat`)

Daftar percakapan dari `GET /kaitech_mobile/chat/conversations`; pesan, kirim, tanda baca, sedang mengetik, reaksi, dan thread lewat rute Discuss Odoo (`/discuss/channel/messages`, `/mail/message/post`, `/discuss/channel/mark_as_read`, `/discuss/channel/notify_typing`, `/mail/message/reaction`, `/discuss/channel/sub_channel/*`) memakai `route()` dari `src/api/odoo.ts`, jadi aturan akses Odoo sama dengan web. Pembaruan langsung lewat `/websocket` dengan cookie sesi yang sama; soket dibuka hanya saat aplikasi aktif dan, setelah tersambung ulang, aplikasi mengambil pesan yang terlewat.

Kirim selalu lewat antrean di SQLite (`chat.db`, tabel `outbox`): setiap pesan membawa `kaitech_chat_send_key` dan setiap berkas kunci unggah `/kaitech_mobile/chat/upload`, jadi kirim ulang setelah jawaban hilang tidak membuat pesan atau berkas kedua. Antrean berurutan per akun: kegagalan jaringan menahan antrean dan dicoba lagi dengan jeda naik sampai 30 detik atau begitu jaringan kembali; penolakan server menandai pesan itu gagal (Coba lagi atau Hapus) tanpa menahan pesan berikutnya. Berkas yang akan dikirim disalin ke folder dokumen aplikasi sampai terkirim. Pesan, percakapan, dan draf (per percakapan, tidak hilang saat rotasi atau ganti ukuran jendela) disimpan per akun dan dihapus saat akun keluar.

Pesan suara: tahan tombol mikrofon untuk merekam (AAC `.m4a`), lepas untuk mengirim, geser ke kiri untuk batal. Izin mikrofon, kamera, dan notifikasi diminta saat fitur itu pertama dipakai; izin notifikasi diminta setelah pesan pertama terkirim.

Push Android lewat FCM bila build membawa `GOOGLE_SERVICES_JSON`; token dan bahasa perangkat didaftarkan ke `/kaitech_mobile/push`, dan mengetuk notifikasi membuka percakapannya (`res_id`) atau layar Discovery lewat `routeForPush()`. iOS tanpa APNs: pesan baru masuk hanya selama aplikasi terbuka, dan daftar percakapan menyebutnya.

Di jendela expanded daftar di kiri (360 dp) dan percakapan di kanan; di compact dan medium percakapan dibuka sebagai layar sendiri. Di medium dan expanded tombol Enter di keyboard fisik mengirim pesan; di compact Enter membuat baris baru. Bila kunci aplikasi aktif, pratinjau di daftar aplikasi terbaru dikosongkan (Android `FLAG_SECURE` saat aplikasi di latar, iOS lapisan blur).

Aksi pesan mengikuti web lab0 (Odoo Discuss dan `kaitech_chat`). Aplikasi membaca `kaitech_chat_features`, status admin, `kaitech_chat_can_make_task`, dan flag GIF dari `/web/session/get_session_info` (`storeData`), jadi aksi yang dimatikan server juga hilang di HP. Tahan lama pada pesan membuka satu lembar: baris emoji (tombol di ujungnya membuka pemilih emoji penuh dari data CLDR Odoo), lalu Balas, Salin, Teruskan, Edit, Hapus; Lainnya berisi balas di thread, sematkan, bintang, tandai belum dibaca, salin tautan, terjemahkan, jadikan task, jadikan aktivitas, jadwalkan rapat, dan siapa yang bereaksi. Aturan siapa boleh apa ada di `messageOptions()` (edit dan hapus untuk penulis atau admin, hapus tertutup setelah 24 jam bila `recall_limit` menyala). Edit memakai composer; draf yang sedang diketik disimpan dan dikembalikan setelah edit. Reaksi dibaca dari store `MessageReactions` Odoo 19.

Alur `signed-in/message-actions.yaml` mengirim satu pesan uji lalu menyematkan, memberi bintang, bereaksi lewat pemilih emoji, mengedit, meneruskan, menjadikan aktivitas, menyalin tautan, menghapus pesan kedua, mencoba memberi bintang dalam mode pesawat (harus muncul pesan gagal), lalu memeriksa hasilnya di server lewat akun web (`scripts/actions-peer.js`). Variabel tambahan: `-e FORWARD_TO=<nama percakapan uji tujuan>`; `-e MAKE_TASK=yes` dan `-e MEETING=yes` hanya untuk akun uji yang punya hak Project dan Chat.

Kepala percakapan hanya berisi judul, panggilan, dan satu tombol Lainnya. Lembarnya berisi notifikasi (senyap dan tingkat: semua, hanya saat disebut, tidak ada), cari di percakapan, pesan tersemat, berkas, thread, anggota (peran pemilik dan admin, undang orang), pesan terjadwal (kirim sekarang, ubah, hapus), jadwalkan rapat, sematkan percakapan, terjemahan otomatis, mode pengumuman, ganti nama atau nama dan deskripsi, latar, tandai semua dibaca, keluar atau sembunyikan, dan hapus thread. Tombol lampir membuka lembar yang juga berisi emoji, GIF (bila server punya kunci GIF atau pengguna admin, sama dengan web), balasan siap pakai (juga dengan mengetik `::`), kirim nanti, dan mendesak dengan sisa kuota harian. Tombol bulat di daftar membuka lembar Baru: satu orang membuka chat, lebih dari satu membuat grup, atau channel bernama (bisa pengumuman). Balasan Coworker menampilkan kartu keputusan dan kartu Wardmote, tautan ke task, proyek, Program, rapat, email, dan rekaman tampil sebagai kartu, bilah tipis di bawah kepala menunjukkan pekerjaan Coworker yang berjalan, dan percakapan yang tertaut ke Proyek atau Program menampilkan bilah tautannya. Setiap item mengikuti flag `kaitech_chat_features` yang sama dengan web.

Alur `signed-in/thread-actions.yaml`, `signed-in/composer-extras.yaml`, dan `signed-in/new-conversation.yaml` memakai variabel `-e GROUP=<grup uji> -e SEARCH=<kata> -e PEER_SEARCH=<awal nama akun web>`; `-e URGENT=yes` hanya bila kuota mendesak akun uji boleh dipakai.

Alur `signed-in/chat.yaml` masuk bila perlu, membuka percakapan dengan akun web, mengirim 25 pesan, menyalakan mode pesawat, mengirim 25 pesan lagi, mematikan mode pesawat, lalu memeriksa lewat server bahwa ke-50 pesan ada tepat sekali, tanda baca dari web, dan pesan suara dua arah. Variabel tambahan: `-e SERVER=<alamat server> -e DB=<database> -e WEB_LOGIN=<akun web> -e WEB_PASSWORD=<sandi> -e CHANNEL_ID=<id percakapan> -e PEER=<nama akun web> -e RUN=<penanda unik>`. Waktu dari tekan Kirim sampai gelembung tampil dicatat di log sebagai `send_visible_ms`.

### Aksi baris (`src/ui/RowActions.tsx`)

Setiap baris daftar (percakapan Chat, percakapan Coworker, Program, bukti, temuan, Aktivitas, rapat MoM, hasil Cari) dibungkus `RowActions`. Tahan lama membuka lembar Lainnya dengan getaran singkat; geser ke kanan membuka aksi ringan (tandai dibaca atau belum, sematkan, ganti judul, salin, bagikan), geser ke kiri membuka arsip, hapus, atau keluar plus Lainnya. TalkBack mendapat semua aksi lembar sebagai aksi kustom di baris itu, dan tombol Lainnya muncul di ujung baris saat baris difokus dengan keyboard. Arsip, hapus dari daftar, keluar, dan hapus percakapan Coworker langsung hilang dari layar dengan snackbar Urungkan; panggilan server baru dikirim setelah 5 detik, atas nama akun yang memintanya. Hapus rekaman MoM memakai syarat server: hanya pengunggah, dengan mengetik judul dan kata sandi.

Sematkan dan arsip percakapan Chat hanya muncul bila server mengirim `pinned` dan `archived` di daftar percakapan. Hapus dari daftar pada chat pribadi memakai `channel_pin` Odoo, jadi percakapan muncul lagi saat ada pesan baru; keluar dari grup memakai `action_unfollow`.

Alur `signed-in/rows-chat.yaml`, `rows-discovery.yaml`, dan `rows-mom.yaml` membuat data ujinya sendiri lewat akun web (grup baru, percakapan Coworker kosong, rekaman pendek) lalu membuktikan tahan lama, kedua sisi geser, Urungkan, dan efeknya di server. Variabel tambahan selain milik `chat.yaml`: `-e PROGRAMME=<id Program uji> -e SEARCH=<kata> -e HIDE_DIRECT=true` (yang terakhir menghapus chat pribadi dengan akun web lalu menunggu ia muncul lagi; hanya satu sel yang boleh menjalankannya pada satu waktu).

Di CI job `e2e android rows` menjalankan ketiga alur itu di ponsel dan tablet, id-ID dan en-US, memakai secret `KAITECH_E2E_LOGIN`, `KAITECH_E2E_PASSWORD`, `KAITECH_E2E_WEB_LOGIN`, `KAITECH_E2E_WEB_PASSWORD` dan variabel `KAITECH_E2E_CHANNEL_ID`, `KAITECH_E2E_PEER`, `KAITECH_E2E_PROGRAMME`, `KAITECH_E2E_SEARCH`. Job ini hanya jalan pada push dan PR dari branch repo ini, tidak dari fork. Karena repo publik, keluarannya tidak membawa rekaman, log aplikasi, atau log Maestro: hanya `junit.xml`, berkas teks perangkat, tangkapan layar alur, dan tangkapan layar langkah yang gagal kecuali langkah masuk (yang bisa memperlihatkan login akun uji), dan job gagal tanpa mengunggah apa pun bila salah satu nilai akun uji ditemukan di keluaran. Keempat sel itu memakai satu akun uji, jadi job ini berada di grup concurrency `kaitech-e2e-account` (`queue: max`): satu sel jalan pada satu waktu di seluruh run, termasuk run PR lain, dan sisanya antre. Job lain yang masuk dengan akun uji yang sama wajib memakai grup itu juga; tanpa itu panggilan, pesan, dan baris dari job lain muncul di layar sel yang sedang jalan (run 45011416923: panggilan video masuk dari job call PR lain menutupi layar tiga sel).

## Lisensi

MIT, lihat `LICENSE`.

The whole device check is one command once an emulator boots:

```bash
CALL_SERVER=… CALL_DB=… CALL_LOGIN=… CALL_PASSWORD=… CALL_CHANNEL_ID=… \
  SERVER=https://… LOGIN=… PASSWORD=… PEER='Uji Chat Web (ZHA-7238)' \
  bash scripts/e2e-call.sh dist/app-release.apk out emulator-5554 en-US phone portrait
```

It locks the orientation, installs the APK, records the screen, starts the browser peer, runs `.maestro/signed-in/call.yaml`, leaves the call, and drops the recording, the junit report, the screenshots and the app log in the output folder.
