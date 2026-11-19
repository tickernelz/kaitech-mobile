#!/usr/bin/env bash
set -euo pipefail

apk_dir="${1:?usage: e2e-android.sh <apk-dir> <output-dir>}"
out="${2:?usage: e2e-android.sh <apk-dir> <output-dir>}"
mkdir -p "$out"

apk="$(find "$apk_dir" -maxdepth 1 -name '*.apk' | head -1)"
[ -n "$apk" ] || { echo "no APK in $apk_dir" >&2; exit 1; }

adb wait-for-device
adb install -r "$apk"
adb shell dumpsys package io.kaitech.mobile | grep -E 'versionCode|versionName' | head -2 | tee "$out/installed.txt"

adb shell screenrecord --bit-rate 4000000 --time-limit 170 /sdcard/e2e.mp4 &
recorder=$!
sleep 1

status=0
maestro test .maestro \
  --format junit \
  --output "$out/junit.xml" \
  --test-output-dir "$out/maestro" || status=$?

sleep 2
adb shell pkill -INT screenrecord || true
wait "$recorder" || true
sleep 2
adb pull /sdcard/e2e.mp4 "$out/e2e-android.mp4"
adb logcat -d > "$out/logcat.txt" || true

exit "$status"
