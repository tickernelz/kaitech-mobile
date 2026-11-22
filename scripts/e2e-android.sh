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
adb reboot
adb wait-for-disconnect
adb wait-for-device
booted=""
for _ in $(seq 1 150); do
  if [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; then
    booted=1
    break
  fi
  sleep 2
done
[ -n "$booted" ] || { echo "emulator did not finish booting after the locale reboot" >&2; exit 1; }

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
rotation_state() { adb shell dumpsys window displays | tr -d '\r' | grep -oE '(mUserRotationMode|mUserRotation|mRotation|mCurrentAppOrientation|mLastOrientation)=[A-Z_0-9]+' | sort -u | tr '\n' ' '; echo; }
adb shell cmd window user-rotation lock "$rotation"
sleep 3
{
  echo "cell: $cell"
  echo "physical size (natural orientation): $natural"
  adb shell wm density | tr -d '\r'
  echo "user rotation: $rotation"
  echo "before maestro: $(rotation_state)"
} | tee "$out/display.txt"

adb shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line'
adb shell am set-debug-app --persistent com.android.chrome
adb install -r "$apk"
adb shell dumpsys package io.kaitech.mobile | grep -E 'versionCode|versionName' | head -2 | tee "$out/installed.txt"

activity="$(adb shell cmd package resolve-activity --brief io.kaitech.mobile | tr -d '\r' | tail -1)"
adb shell am start -W -n "$activity" > /dev/null
target="mRotation=ROTATION_$((rotation * 90)) "
stable=0
for _ in $(seq 1 60); do
  if rotation_state | grep -q "$target"; then
    stable=$((stable + 1))
    [ "$stable" -ge 10 ] && break
  else
    stable=0
    echo "rotation drifted, locking again: $(rotation_state)" | tee -a "$out/display.txt"
    adb shell cmd window user-rotation lock "$rotation"
  fi
  sleep 1
done
echo "app in front: $(rotation_state)" | tee -a "$out/display.txt"
adb shell dumpsys window displays | tr -d '\r' | sed -n '/DisplayRotation/,/^ *$/p' > "$out/rotation-dump.txt" || true
[ "$stable" -ge 10 ] || { echo "rotation did not hold at $((rotation * 90)) degrees" >&2; exit 1; }

read -ra flows <<< "${E2E_FLOWS:-.maestro}"
signed_in=()
if [ -n "${E2E_LOGIN:-}" ]; then
  adb shell settings put global heads_up_notifications_enabled 0
  signed_in=(
    -e LOGIN="$E2E_LOGIN" -e PASSWORD="$E2E_PASSWORD"
    -e SERVER="$E2E_SERVER" -e DB="$E2E_DB"
    -e WEB_LOGIN="$E2E_WEB_LOGIN" -e WEB_PASSWORD="$E2E_WEB_PASSWORD"
    -e CHANNEL_ID="$E2E_CHANNEL_ID" -e PEER="$E2E_PEER"
    -e PROGRAMME="$E2E_PROGRAMME" -e SEARCH="$E2E_SEARCH"
    -e HIDE_DIRECT="${E2E_HIDE_DIRECT:-false}" -e RUN="E2E$(date +%s)${RANDOM}"
  )
fi

recording="e2e-android-$cell.mp4"
if [ -z "${E2E_LOGIN:-}" ]; then
  adb shell screenrecord --bit-rate 4000000 --time-limit 170 "/sdcard/$recording" &
  recorder=$!
  sleep 1
fi

status=0
maestro test "${flows[@]}" \
  -e APP_LANGUAGE="$language" \
  -e DEVICE_SIZE="$size" \
  -e ORIENTATION="$orientation" \
  "${signed_in[@]}" \
  --format junit \
  --output "$out/junit.xml" \
  --test-output-dir "$out/maestro" || status=$?

if [ -n "${E2E_THEMED_FLOWS:-}" ]; then
  read -ra themed <<< "$E2E_THEMED_FLOWS"
  for theme in light dark; do
    adb shell cmd uimode night "$([ "$theme" = dark ] && echo yes || echo no)"
    maestro test "${themed[@]}" \
      -e APP_LANGUAGE="$language" \
      -e DEVICE_SIZE="$size" \
      -e ORIENTATION="$orientation" \
      -e THEME="$theme" \
      "${signed_in[@]}" \
      --format junit \
      --output "$out/junit-$theme.xml" \
      --test-output-dir "$out/maestro/$theme" || status=$?
  done
  adb shell cmd uimode night no
fi

sleep 2
if [ -z "${E2E_LOGIN:-}" ]; then
  adb shell pkill -INT screenrecord || true
  wait "$recorder" || true
  sleep 2
  adb pull "/sdcard/$recording" "$out/$recording"
  app_uid="$(adb shell cmd package list packages -U io.kaitech.mobile | tr -d '\r' | sed -n 's/.* uid:\([0-9]*\).*/\1/p' | head -1)"
  adb logcat -d -b main,crash --uid="$app_uid" > "$out/logcat.txt" || true
fi
find "$out/maestro" -name device-logcat.txt -delete
echo "after maestro: $(rotation_state)" | tee -a "$out/display.txt"

mkdir -p "$out/screenshots"
find "$out/maestro" -path '*/takeScreenshot/*.png' -exec cp {} "$out/screenshots/" \;
node scripts/check-screenshots.mjs "$out/screenshots" "$size" "$orientation" "$language" || status=1

if [ -n "${E2E_LOGIN:-}" ]; then
  mkdir -p "$out/failures"
  find "$out/maestro" -path '*/screenshots/*.png' ! -name '*runFlow*' ! -iname '*email*' ! -iname '*password*' ! -iname '*sandi*' ! -iname '*sign*in*' ! -iname '*masuk*' ! -iname '*login*' -exec cp {} "$out/failures/" \;
  find "$out" -mindepth 1 -maxdepth 1 ! -name 'junit*.xml' ! -name locale.txt ! -name display.txt ! -name installed.txt ! -name screenshots ! -name failures -exec rm -rf {} +
  for secret in "$E2E_LOGIN" "$E2E_PASSWORD" "$E2E_WEB_LOGIN" "$E2E_WEB_PASSWORD"; do
    if grep -rqF -- "$secret" "$out" || find "$out" | grep -F -- "$secret" > /dev/null; then
      echo "a test account value is in the E2E output; it was not uploaded" >&2
      rm -rf "$out"
      status=1
      break
    fi
  done
fi

if [ "${COLD_START_RUNS:-0}" -gt 0 ]; then
  adb shell am start -W -S -n "$activity" > /dev/null
  sleep 5
  starts=()
  for _ in $(seq 1 "$COLD_START_RUNS"); do
    total="$(adb shell am start -W -S -n "$activity" | tr -d '\r' | sed -n 's/^TotalTime: //p')"
    [ -n "$total" ] || { echo "am start -W printed no TotalTime" >&2; status=1; break; }
    starts+=("$total")
    sleep 2
  done
  if [ "${#starts[@]}" -eq "$COLD_START_RUNS" ]; then
    median="$(printf '%s\n' "${starts[@]}" | sort -n | sed -n "$(((COLD_START_RUNS + 1) / 2))p")"
    echo "cold start TotalTime ms: ${starts[*]} (median $median)" | tee "$out/cold-start.txt"
    node scripts/perf-gate.mjs --out "$out/perf-cold-start.json" "android.cold_start_ms=$median" || status=1
  fi
fi

exit "$status"
