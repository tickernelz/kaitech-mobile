#!/usr/bin/env bash
set -euo pipefail
. scripts/e2e-lease.sh

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
guest_memory() { adb shell 'grep -E "^(MemTotal|MemAvailable|SwapTotal|SwapFree):" /proc/meminfo; sed "s/^/pressure /" /proc/pressure/memory' 2> /dev/null | tr -d '\r' | tr -s ' \n' ' ' || true; }
is_root() { [ "$(adb shell id -u 2>/dev/null | tr -d '\r')" = 0 ]; }
become_root() {
  for _ in $(seq 1 10); do
    adb root >/dev/null 2>&1 || true
    adb wait-for-device
    is_root && return 0
    sleep 3
  done
  echo "adb root unavailable on the emulator" >&2
  exit 1
}

adb wait-for-device
config="$(framework_config)"
locale_reboot=no
if [[ "$config" != *"-$language-r$region-"* ]]; then
  locale_reboot="yes, from ${config:-none}"
  become_root
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
  maestro) run=(maestro ${ANDROID_SERIAL:+--device "$ANDROID_SERIAL"}) ;;
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

gboard=com.google.android.inputmethod.latin
if adb shell pm path "$gboard" 2>/dev/null | grep -q '^package:'; then
  become_root
  gboard_dir="/data/user_de/0/$gboard/shared_prefs"
  gboard_prefs="$gboard_dir/${gboard}_preferences.xml"
  gboard_owner="$(adb shell stat -c %u:%g "/data/user_de/0/$gboard" | tr -d '\r')"
  verbatim_keys="auto_cap pref_key_auto_correction pref_key_latin_auto_correction pref_key_pk_auto_correction latin_pk_auto_capitalize"
  adb shell am force-stop "$gboard"
  current="$(adb shell "cat $gboard_prefs 2>/dev/null" | tr -d '\r' | grep '<' || true)"
  [ -n "$current" ] || current="<?xml version='1.0' encoding='utf-8' standalone='yes' ?>"$'\n'"<map>"$'\n'"</map>"
  current="$(sed 's#<map */>#<map>\n</map>#' <<< "$current")"
  for key in $verbatim_keys; do
    current="$(grep -v "name=\"$key\"" <<< "$current" | sed "s#</map>#    <boolean name=\"$key\" value=\"false\" />\n</map>#")"
  done
  adb shell "mkdir -p $gboard_dir && cat > $gboard_prefs" <<< "$current"
  adb shell chown "$gboard_owner" "$gboard_dir" "$gboard_prefs"
  adb shell chmod 660 "$gboard_prefs"
  adb shell restorecon -R "$gboard_dir"
  keys_off="$(adb shell cat "$gboard_prefs" | tr -d '\r' | grep -oE "name=\"(${verbatim_keys// /|}|enable_auto_capitalization)\" value=\"false\"" | sed 's/enable_auto_capitalization/auto_cap/' | sort -u | wc -l)"
  echo "gboard typing: $keys_off of 5 verbatim keys off, $(adb shell ls -Z "$gboard_prefs" | tr -d '\r')" | tee -a "$out/display.txt"
  if [ "$keys_off" != 5 ]; then
    echo "gboard prefs did not take the verbatim keys" >&2
    exit 1
  fi
fi

adb shell settings put global hide_error_dialogs 1
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null
adb shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run --remote-debugging-socket-name=kaitech_e2e_chrome" > /data/local/tmp/chrome-command-line'
adb shell am set-debug-app --persistent com.android.chrome
if adb shell pm path io.kaitech.mobile 2>/dev/null | grep -q '^package:'; then
  adb uninstall io.kaitech.mobile
fi
adb logcat -b main,system,crash,events -G 16M > /dev/null 2>&1 || true
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
    -e MINUTES_NAME="${E2E_MINUTES_NAME:-}" -e FOLLOWUP_OWNER="${E2E_FOLLOWUP_OWNER:-}"
  )
  node scripts/e2e-prune-devices.mjs | tee "$out/devices-pruned.txt" || echo "the test-account device prune failed; calls ring every stale device" >&2
fi

hold_server "${GITHUB_RUN_ID:-local} android $cell"

peer_state="$(mktemp -d)/call-peer.json"
peers_dir="$(mktemp -d)"
many_peers() {
  CALL_PEERS=2 CALL_PEER_JOIN=command CALL_VIDEO=0 CALL_LOGIN_2="$E2E_SECOND_PEER_LOGIN" CALL_PASSWORD_2="$E2E_SECOND_PEER_PASSWORD" \
    CALL_CHANNEL_ID="$1" CALL_PEER_STATE="$peers_dir/$2.json" CALL_PEER_PORT="$3" node scripts/call-peer.mjs "$4"
}
stop_peers() {
  node scripts/call-peer.mjs stop >/dev/null 2>&1 || true
  if [ -n "${E2E_GROUP_CALL_ID:-}" ]; then
    many_peers "$E2E_GROUP_CALL_ID" group 8766 stop >/dev/null 2>&1 || true
    many_peers "$E2E_CHANNEL_CALL_ID" channel 8768 stop >/dev/null 2>&1 || true
  fi
}
if [ "${E2E_CALL_PEER:-}" = 1 ]; then
  export CALL_SERVER="$E2E_SERVER" CALL_DB="$E2E_DB" CALL_LOGIN="$E2E_WEB_LOGIN" CALL_PASSWORD="$E2E_WEB_PASSWORD"
  export CALL_CHANNEL_ID="$E2E_CHANNEL_ID" CALL_VIDEO=1 CALL_PEER_HOLD_MS=1 CALL_PEER_STATE="$peer_state" CALL_PEER_PORT=8765
  trap stop_peers EXIT
  if [ ! -f node_modules/livekit-client/dist/livekit-client.umd.js ]; then
    livekit="$(node -p "require('./package-lock.json').packages['node_modules/livekit-client'].version")"
    peer_modules="$(mktemp -d)"
    npm install --prefix "$peer_modules" --no-save --no-audit --no-fund --ignore-scripts "livekit-client@$livekit" > /dev/null
    mkdir -p node_modules
    ln -s "$peer_modules/node_modules/livekit-client" node_modules/livekit-client
  fi
  node scripts/call-peer.mjs start > /dev/null
fi

recording="e2e-android-$cell.mp4"
if [ -z "${E2E_LOGIN:-}" ]; then
  adb shell screenrecord --bit-rate 4000000 --time-limit 170 "/sdcard/$recording" &
  recorder=$!
  sleep 1
fi

audio_log=""
if [ -n "${E2E_LOGIN:-}" ]; then
  audio_log="$(mktemp)"
  adb logcat -v threadtime -b main,system,crash > "$audio_log" 2> /dev/null &
  audio_logger=$!
fi

transport_log="$out/transport.txt"
: > "$transport_log"
watch_transport() {
  local code
  while :; do
    adb wait-for-disconnect 2> /dev/null || { code=$?; break; }
    echo "$(date -u +%H:%M:%S.%3N) emulator-5554 left the adb server" >> "$transport_log"
    adb wait-for-device 2> /dev/null || { code=$?; break; }
    echo "$(date -u +%H:%M:%S.%3N) emulator-5554 back as $(adb get-state 2>&1)" >> "$transport_log"
  done
  echo "$(date -u +%H:%M:%S.%3N) transport watcher stopped: adb exit $code" >> "$transport_log"
}
watch_transport &
transport_watcher=$!

if [ "$runner" = maestro ]; then
  adb shell am force-stop dev.devicelab.driver.android.test
  adb shell am force-stop dev.devicelab.driver.android
fi
console="$(mktemp)"
echo "runner: $runner" | tee -a "$out/display.txt"
echo "memory before flows: $(guest_memory)" | tee -a "$out/display.txt"
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
if grep -rqsE --include=maestro-runner.log 'CDP socket available.*\(type=browser\)' "$out/maestro"; then
  echo "::error::maestro-runner found a Chrome DevTools socket and looked for native elements in the page DOM"
  status=1
fi

if [ -n "${E2E_THEMED_FLOWS:-}" ]; then
  read -ra themed <<< "$E2E_THEMED_FLOWS"
  for theme in light dark; do
    adb shell cmd uimode night "$([ "$theme" = dark ] && echo yes || echo no)"
    "${run[@]}" test "${themed[@]}" \
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

if [ -n "${E2E_SCROLL_FLOW:-}" ]; then
  "${run[@]}" test "${E2E_SCROLL_FLOW%.yaml}-ready.yaml" "${signed_in[@]}" --format junit --output "$out/junit-scroll-ready.xml" --test-output-dir "$out/maestro/scroll-ready" || status=$?
  adb shell dumpsys gfxinfo io.kaitech.mobile reset > /dev/null
  "${run[@]}" test "$E2E_SCROLL_FLOW" "${signed_in[@]}" --format junit --output "$out/junit-scroll.xml" --test-output-dir "$out/maestro/scroll" || status=$?
  adb shell dumpsys gfxinfo io.kaitech.mobile | tr -d '\r' | sed -n '/^Total frames rendered/,/^99th percentile/p' > "$out/scroll-gfxinfo.txt"
fi

if [ "${E2E_LAYOUT_CHECK:-}" = 1 ]; then
  for pkg in dev.devicelab.driver.android.test dev.devicelab.driver.android dev.mobile.maestro.test dev.mobile.maestro; do
    adb shell am force-stop "$pkg"
  done
  adb shell cmd uimode night no
  adb shell am start -S -W -n "$activity" > /dev/null
  sleep 3
  node scripts/e2e-layout.mjs "$out" "$size" "$orientation" "$language" || status=1
fi

if [ "${E2E_CALL_PEER:-}" = 1 ]; then
  node scripts/call-peer.mjs leave > "$out/call-peer.json" 2>&1 || true
  if [ -n "${E2E_GROUP_CALL_ID:-}" ]; then
    if many_peers "$E2E_GROUP_CALL_ID" group 8766 start > "$out/call-peers-start.json" 2>&1 &&
      many_peers "$E2E_CHANNEL_CALL_ID" channel 8768 start >> "$out/call-peers-start.json" 2>&1; then
      "${run[@]}" test .maestro/signed-in/call-many.yaml \
        -e APP_LANGUAGE="$language" -e DEVICE_SIZE="$size" -e ORIENTATION="$orientation" \
        "${signed_in[@]}" \
        -e GROUP_NAME="$E2E_GROUP_CALL_NAME" -e CHANNEL_NAME="$E2E_CHANNEL_CALL_NAME" \
        -e GROUP_PEER_1=8766 -e GROUP_PEER_2=8767 -e CHANNEL_PEER_1=8768 -e CHANNEL_PEER_2=8769 \
        --format junit --output "$out/junit-call-many.xml" --test-output-dir "$out/maestro/call-many" || status=$?
    else
      echo "::error::the group and channel call peers did not start; see call-peers-start.json"
      status=1
    fi
    many_peers "$E2E_GROUP_CALL_ID" group 8766 leave > "$out/call-peers-group.json" 2>&1 || true
    many_peers "$E2E_CHANNEL_CALL_ID" channel 8768 leave > "$out/call-peers-channel.json" 2>&1 || true
  fi
  call_uid="$(adb shell cmd package list packages -U io.kaitech.mobile | tr -d '\r' | sed -n 's/.* uid:\([0-9]*\).*/\1/p' | head -1)"
  adb logcat -d -b main,crash -v time --uid="$call_uid" | grep -E 'KaitechCall|ReactNativeJS|AndroidRuntime|Logging|PeerConnection|livekit' | grep -viE 'token|cookie|session_id|password|authorization' | tail -n 600 > "$out/call-logcat.txt" || true
fi
release_server

sleep 2
mapfile -t watcher_adb < <(pgrep -P "$transport_watcher" || true)
kill "$transport_watcher" 2> /dev/null || true
wait "$transport_watcher" 2> /dev/null || true
[ "${#watcher_adb[@]}" -eq 0 ] || kill "${watcher_adb[@]}" 2> /dev/null || true
secrets=()
for secret in "${E2E_LOGIN:-}" "${E2E_PASSWORD:-}" "${E2E_WEB_LOGIN:-}" "${E2E_WEB_PASSWORD:-}" ${E2E_SECOND_PEER_LOGIN:+"$E2E_SECOND_PEER_LOGIN"} ${E2E_SECOND_PEER_PASSWORD:+"$E2E_SECOND_PEER_PASSWORD"}; do
  [ -n "$secret" ] && secrets+=(-e "$secret")
done
[ "${#secrets[@]}" -gt 0 ] || secrets=(-e $'\x01')
head='^[0-9-]+ [0-9:.]+ +[0-9]+ +[0-9]+ [VDIWEF] '
if [ -s "$transport_log" ] || [ "$status" != 0 ]; then
  cat "$transport_log"
  tail -n 400 "${TMPDIR:-/tmp}/adb.$(id -u).log" > "$out/adb-server.log" 2> /dev/null || true
  adb logcat -d -b main,system,crash,events -v threadtime 2> /dev/null | grep -aE \
    -e "${head}(adbd|init|lmkd|lowmemorykiller|libc|DEBUG|Watchdog|AndroidRuntime|TestRunner|MonitoringInstr|am_kill|am_proc_died|am_crash|am_anr)[^ :]* *: " \
    -e "${head}ActivityManager *: .*(dev\.mobile\.maestro|Killing|has died|Process .* died)" \
    | grep -avF "${secrets[@]}" > "$out/device-transport.txt" || true
  find "$out/maestro" -name maestro.log -print0 2> /dev/null | while IFS= read -r -d '' log; do
    echo "== ${log#"$out/maestro"}"
    grep -aE 'dadb|adb|AndroidDriver|AndroidDeviceConnection|DeviceServerDied|DeviceUnreachable|[Ii]nstrument|[Uu]ninstall|[Ii]nstall|Shutdown device|Exception|Caused by|Unknown error' "$log" | grep -avF "${secrets[@]}" | tail -n 300 || true
  done > "$out/maestro-transport.txt" || true
fi
if [ -n "$audio_log" ]; then
  kill "$audio_logger" 2> /dev/null || true
  wait "$audio_logger" 2> /dev/null || true
  grep -aE \
    -e "${head}[^ :]*([Aa]udio|AUDIO|AHAL|MediaRecorder|StagefrightRecorder|MPEG4Writer|CCodec|MediaCodec|AndroidRuntime)[^ :]* *: " \
    -e "${head}ReactNativeJS *: .*[Rr]ecord" \
    -e "${head}ActivityManager *: .*(AudioRecordingService|ANR in io\.kaitech\.mobile|Process io\.kaitech\.mobile )" \
    "$audio_log" > "$out/audio.txt" || true
  if [ "$status" != 0 ]; then
    {
      grep -aE \
        -e "${head}ActivityTaskManager *: (START|Displayed)" \
        -e "${head}ActivityManager *: .*(Start proc|has died|Killing|ANR in|Force stopping).*(com\.android\.chrome|io\.kaitech\.mobile)" \
        -e "${head}WindowManager *: .*(Changing focus|Not Responding)" \
        -e "${head}AndroidRuntime *: " \
        -e "^[0-9-]+ [0-9:.]+ +[0-9]+ +[0-9]+ [WEF] (chromium|cr_[A-Za-z]+) *: " \
        "$audio_log" || true
      echo "activities at the end:"
      adb shell dumpsys activity activities | tr -d '\r' | grep -E 'Task\{|Hist +#|ResumedActivity' || true
    } | sed -E 's#(https?://[^ ?}]*)\?[^ }]*#\1?<query>#g' | grep -avF "${secrets[@]}" > "$out/signin.txt" || true
  fi
  rm -f "$audio_log"
fi
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
echo "memory after flows: $(guest_memory)" | tee -a "$out/display.txt"

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
  find "$out" -mindepth 1 -maxdepth 1 ! -name 'junit*.xml' ! -name locale.txt ! -name display.txt ! -name installed.txt ! -name audio.txt ! -name signin.txt ! -name scroll-gfxinfo.txt ! -name layout.txt ! -name call-peer.json ! -name 'call-peers-*.json' ! -name call-logcat.txt ! -name devices-pruned.txt ! -name transport.txt ! -name adb-server.log ! -name device-transport.txt ! -name maestro-transport.txt ! -name screenshots ! -name failures -exec rm -rf {} +
  for secret in "$E2E_LOGIN" "$E2E_PASSWORD" "$E2E_WEB_LOGIN" "$E2E_WEB_PASSWORD" ${E2E_SECOND_PEER_LOGIN:+"$E2E_SECOND_PEER_LOGIN"} ${E2E_SECOND_PEER_PASSWORD:+"$E2E_SECOND_PEER_PASSWORD"}; do
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
  echo "load before cold start: $(adb shell cat /proc/loadavg | cut -d' ' -f1-3)" | tee -a "$out/display.txt"
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
