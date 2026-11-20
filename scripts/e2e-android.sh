#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-android.sh <apk-dir> <output-dir> <locale: en-US|id-ID> <size: phone|tablet> <orientation: portrait|landscape>"
apk_dir="${1:?$usage}"
out="${2:?$usage}"
locale="${3:?$usage}"
size="${4:?$usage}"
orientation="${5:?$usage}"
case "$orientation" in portrait | landscape) ;; *) echo "$usage" >&2; exit 2 ;; esac
language="${locale%%-*}"
cell="$size-$orientation-$locale"
mkdir -p "$out"

apk="$(find "$apk_dir" -maxdepth 1 -name '*.apk' | head -1)"
[ -n "$apk" ] || { echo "no APK in $apk_dir" >&2; exit 1; }

region="${locale#*-}"

adb wait-for-device
is_root() { [ "$(adb shell id -u 2>/dev/null | tr -d '\r')" = 0 ]; }
for _ in $(seq 1 10); do
  adb root >/dev/null 2>&1 || true
  adb wait-for-device
  is_root && break
  sleep 3
done
is_root || { echo "adb root unavailable on the emulator" >&2; exit 1; }
adb shell setprop persist.sys.locale "$locale"
adb shell setprop ctl.restart zygote

ready=""
for _ in $(seq 1 120); do
  config="$(adb shell am get-config 2>/dev/null | tr -d '\r' | grep -m1 '^config:' || true)"
  if [[ "$config" == *"-$language-r$region-"* ]] && adb shell service check package 2>/dev/null | grep -q found; then
    ready=1
    break
  fi
  sleep 2
done
echo "framework config: ${config:-none} (expected $language-r$region)" | tee "$out/locale.txt"
[ -n "$ready" ] || { echo "framework did not come up in $locale" >&2; exit 1; }
sleep 5

natural="$(adb shell wm size | tr -d '\r' | sed -n 's/^Physical size: //p')"
natural_width="${natural%x*}"
natural_height="${natural#*x}"
if { [ "$orientation" = landscape ] && [ "$natural_width" -gt "$natural_height" ]; } ||
  { [ "$orientation" = portrait ] && [ "$natural_width" -lt "$natural_height" ]; }; then
  rotation=0
else
  rotation=1
fi
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation "$rotation"
sleep 3
{
  echo "cell: $cell"
  echo "physical size (natural orientation): $natural"
  adb shell wm density | tr -d '\r'
  echo "user_rotation: $rotation"
} | tee "$out/display.txt"

adb install -r "$apk"
adb shell dumpsys package io.kaitech.mobile | grep -E 'versionCode|versionName' | head -2 | tee "$out/installed.txt"

recording="e2e-android-$cell.mp4"
adb shell screenrecord --bit-rate 4000000 --time-limit 170 "/sdcard/$recording" &
recorder=$!
sleep 1

status=0
maestro test .maestro \
  -e APP_LANGUAGE="$language" \
  -e DEVICE_SIZE="$size" \
  -e ORIENTATION="$orientation" \
  --format junit \
  --output "$out/junit.xml" \
  --test-output-dir "$out/maestro" || status=$?

sleep 2
adb shell pkill -INT screenrecord || true
wait "$recorder" || true
sleep 2
adb pull "/sdcard/$recording" "$out/$recording"
adb logcat -d > "$out/logcat.txt" || true

mkdir -p "$out/screenshots"
find "$out/maestro" -path '*/takeScreenshot/*.png' -exec cp {} "$out/screenshots/" \;
node scripts/check-screenshots.mjs "$out/screenshots" "$size" "$orientation" "$language" || status=1

exit "$status"
