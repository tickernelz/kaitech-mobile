Rilis uji Kaitech untuk tim, bukan rilis toko.

- **Android**: pasang `kaitech-<build>-<sha>-arm64-v8a.apk` (hampir semua ponsel Android sekarang); bila Android menolak memasangnya, pasang `kaitech-<build>-<sha>.apk` (universal, lebih besar). Keduanya ditandatangani keystore non-toko yang sama dengan rilis sebelumnya, jadi bisa memperbarui aplikasi yang sudah terpasang.
- **iOS**: `kaitech-<build>-<sha>-unsigned.ipa` tanpa tanda tangan; tanda tangani ulang lewat AltStore atau Sideloadly dengan Apple ID pribadi. Masuk lewat Universal Link, APNs, VoIP push, dan CallKit butuh akun Apple Developer dan belum terverifikasi.
- Periksa unduhan: `sha256sum -c --ignore-missing SHA256SUMS.txt`.

Cara pasang, apa yang terbukti di emulator (ukuran, orientasi, bahasa), dan apa yang belum: [README](https://github.com/tickernelz/kaitech-mobile#rilis).
