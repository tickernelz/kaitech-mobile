#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-android.sh <apk-dir> <output-dir> <locale, e.g. en-US or id-ID>"
apk_dir="${1:?$usage}"
out="${2:?$usage}"
locale="${3:?$usage}"
language="${locale%%-*}"
mkdir -p "$out"

apk="$(find "$apk_dir" -maxdepth 1 -name '*.apk' | head -1)"
[ -n "$apk" ] || { echo "no APK in $apk_dir" >&2; exit 1; }

adb wait-for-device
device_locale="$(adb shell getprop persist.sys.locale | tr -d '\r')"
echo "device locale: $device_locale (expected $locale)" | tee "$out/locale.txt"
[ "$device_locale" = "$locale" ] || { echo "emulator did not boot in $locale" >&2; exit 1; }

adb install -r "$apk"
adb shell dumpsys package io.kaitech.mobile | grep -E 'versionCode|versionName' | head -2 | tee "$out/installed.txt"

recording="e2e-android-$locale.mp4"
adb shell screenrecord --bit-rate 4000000 --time-limit 170 "/sdcard/$recording" &
recorder=$!
sleep 1

status=0
maestro test .maestro \
  -e APP_LANGUAGE="$language" \
  --format junit \
  --output "$out/junit.xml" \
  --test-output-dir "$out/maestro" || status=$?

sleep 2
adb shell pkill -INT screenrecord || true
wait "$recorder" || true
sleep 2
adb pull "/sdcard/$recording" "$out/$recording"
adb logcat -d > "$out/logcat.txt" || true

exit "$status"
