#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-android.sh <apk-dir> <output-dir> <locale: en-US|id-ID> <size: phone|tablet> <orientation: portrait|landscape>"
apk_dir="${1:?$usage}"
out="${2:?$usage}"
locale="${3:?$usage}"
size="${4:?$usage}"
orientation="${5:?$usage}"
case "$orientation" in portrait | landscape) ;; *) echo "$usage" >&2; exit 2 ;; esac
runner="${E2E_RUNNER:-auto}"
case "$runner" in
  auto | maestro | maestro-runner) ;;
  *) echo "E2E_RUNNER must be auto, maestro or maestro-runner, not $runner" >&2; exit 2 ;;
esac
language="${locale%%-*}"
cell="$size-$orientation-$locale"
mkdir -p "$out"

apk="$(find "$apk_dir" -maxdepth 1 -name '*.apk' | head -1)"
[ -n "$apk" ] || { echo "no APK in $apk_dir" >&2; exit 1; }

region="${locale#*-}"

framework_config() { adb shell am get-config 2>/dev/null | tr -d '\r' | grep -m1 '^config:' || true; }

adb wait-for-device
config="$(framework_config)"
locale_reboot=no
if [[ "$config" != *"-$language-r$region-"* ]]; then
  locale_reboot="yes, from ${config:-none}"
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
fi

ready=""
for _ in $(seq 1 120); do
  config="$(framework_config)"
  if [[ "$config" == *"-$language-r$region-"* ]] && adb shell service check package 2>/dev/null | grep -q found; then
    ready=1
    break
  fi
  sleep 2
done
echo "framework config: ${config:-none} (expected $language-r$region), locale reboot: $locale_reboot" | tee "$out/locale.txt"
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
if [ "$runner" = auto ]; then
  if [ "$rotation" = 0 ]; then runner=maestro-runner; else runner=maestro; fi
fi
case "$runner" in
  maestro) run=(maestro) ;;
  maestro-runner) run=(maestro-runner --no-ansi --platform android --driver devicelab ${ANDROID_SERIAL:+--device "$ANDROID_SERIAL"}) ;;
esac
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
if adb shell pm path io.kaitech.mobile 2>/dev/null | grep -q '^package:'; then
  adb uninstall io.kaitech.mobile
fi
adb logcat -c
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

if [ "$runner" = maestro ]; then
  adb shell am force-stop dev.devicelab.driver.android.test
  adb shell am force-stop dev.devicelab.driver.android
fi
console="$(mktemp)"
echo "runner: $runner" | tee -a "$out/display.txt"
set +e
"${run[@]}" test "${flows[@]}" \
  -e APP_LANGUAGE="$language" \
  -e DEVICE_SIZE="$size" \
  -e ORIENTATION="$orientation" \
  "${signed_in[@]}" \
  --format junit \
  --output "$out/junit.xml" \
  --test-output-dir "$out/maestro" 2>&1 | tee "$console"
status="${PIPESTATUS[0]}"
set -e
if grep -q 'telemetry (debug, not sent)' "$console"; then
  echo "::error::maestro-runner built a telemetry event: telemetry is on"
  status=1
fi
rm -f "$console"

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
if [ "$runner" = maestro ]; then
  find "$out/maestro" -path '*/takeScreenshot/*.png' -exec cp {} "$out/screenshots/" \;
else
  while IFS= read -r -d '' shot; do
    name="$(basename "$shot")"
    cp "$shot" "$out/screenshots/${name#cmd-[0-9][0-9][0-9]-}"
  done < <(find "$out/maestro" -path '*/assets/*' -name 'cmd-[0-9][0-9][0-9]-*.png' ! -name 'cmd-[0-9][0-9][0-9]-before.png' ! -name 'cmd-[0-9][0-9][0-9]-after.png' ! -name 'cmd-[0-9][0-9][0-9]-diff.png' -print0)
fi
node scripts/check-screenshots.mjs "$out/screenshots" "$size" "$orientation" "$language" || status=1

if [ -n "${E2E_LOGIN:-}" ]; then
  mkdir -p "$out/failures"
  find "$out/maestro" -path '*/screenshots/*.png' ! -name '*runFlow*' ! -iname '*email*' ! -iname '*password*' ! -iname '*sandi*' ! -iname '*sign*in*' ! -iname '*masuk*' ! -iname '*login*' -exec cp {} "$out/failures/" \;
  find "$out" -mindepth 1 -maxdepth 1 ! -name junit.xml ! -name locale.txt ! -name display.txt ! -name installed.txt ! -name screenshots ! -name failures -exec rm -rf {} +
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
  for pkg in dev.devicelab.driver.android.test dev.devicelab.driver.android dev.mobile.maestro.test dev.mobile.maestro; do
    adb shell am force-stop "$pkg"
  done
  load=""
  for _ in $(seq 1 60); do
    load="$(adb shell cat /proc/loadavg | cut -d' ' -f1)"
    awk -v load="$load" 'BEGIN { exit !(load < 1.5) }' && break
    sleep 2
  done
  echo "load before cold start: $load" | tee -a "$out/display.txt"
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
