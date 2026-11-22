#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-runner-trial.sh <apk-dir> <output-dir> <first: cli|runner> <maestro-runner driver> (flows from E2E_TRIAL_FLOWS)"
apk_dir="${1:?$usage}"
out="${2:?$usage}"
first="${3:?$usage}"
driver="${4:?$usage}"
case "$first" in
  cli) order=(cli runner) ;;
  runner) order=(runner cli) ;;
  *) echo "$usage" >&2; exit 2 ;;
esac
read -ra flows <<< "${E2E_TRIAL_FLOWS:?E2E_TRIAL_FLOWS is empty}"
mkdir -p "$out"
console="${RUNNER_TEMP:-/tmp}/e2e-runner-trial-console.log"
: > "$console"

apk="$(find "$apk_dir" -maxdepth 1 -name '*.apk' | head -1)"
[ -n "$apk" ] || { echo "no APK in $apk_dir" >&2; exit 1; }

negative=.maestro/negative-control.yaml
trap 'rm -f "$negative"' EXIT
{
  sed 's/^name: .*/name: Negative control, welcome then an element the app never renders/' .maestro/welcome.yaml
  printf -- '- launchApp\n- assertVisible:\n    id: e2e-negative-control-never-rendered\n'
} > "$negative"
flows+=("$negative")

maestro-runner --no-ansi lint "${flows[@]}" 2>&1 | tee "$out/preflight.txt" || echo "maestro-runner lint exit ${PIPESTATUS[0]}" | tee -a "$out/preflight.txt"

adb wait-for-device
booted=""
for _ in $(seq 1 150); do
  if [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; then
    booted=1
    break
  fi
  sleep 2
done
[ -n "$booted" ] || { echo "emulator did not finish booting" >&2; exit 1; }
config="$(adb shell am get-config 2>/dev/null | tr -d '\r' | grep -m1 '^config:' || true)"
echo "framework config: ${config:-none} (expected en-rUS)" | tee "$out/locale.txt"
[[ "$config" =~ (^|[\ -])en-rUS- ]] || { echo "emulator is not in en-US" >&2; exit 1; }

adb shell cmd window user-rotation lock 0
adb shell settings put global heads_up_notifications_enabled 0
adb shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line'
adb shell am set-debug-app --persistent com.android.chrome
adb install -r "$apk"
adb shell dumpsys package io.kaitech.mobile | grep -E 'versionCode|versionName' | head -2 | tee "$out/installed.txt"
{
  echo "maestro: $(maestro --version 2>/dev/null | tail -1)"
  echo "maestro-runner: $(maestro-runner --version 2>/dev/null | head -1), driver $driver"
  echo "first: $first"
} | tee "$out/runners.txt"

measure_py='
import resource, subprocess, sys, time
start = time.monotonic()
code = subprocess.call(sys.argv[2:], stdin=subprocess.DEVNULL)
wall = time.monotonic() - start
rss = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
with open(sys.argv[1], "w") as stats:
    stats.write(f"{code}\t{wall:.1f}\t{rss}\n")
'

signed_in=()
if [ -n "${E2E_LOGIN:-}" ]; then
  signed_in=(
    -e LOGIN="$E2E_LOGIN" -e PASSWORD="$E2E_PASSWORD"
    -e SERVER="$E2E_SERVER" -e DB="$E2E_DB"
    -e WEB_LOGIN="$E2E_WEB_LOGIN" -e WEB_PASSWORD="$E2E_WEB_PASSWORD"
    -e CHANNEL_ID="$E2E_CHANNEL_ID" -e PEER="$E2E_PEER"
    -e PROGRAMME="$E2E_PROGRAMME" -e SEARCH="$E2E_SEARCH"
    -e HIDE_DIRECT="${E2E_HIDE_DIRECT:-false}"
  )
fi

printf 'flow\trunner\texit\twall_s\tpeak_rss_kb\n' > "$out/results.tsv"
for flow in "${flows[@]}"; do
  name="$(basename "$flow" .yaml)"
  for runner in "${order[@]}"; do
    dir="$out/$name/$runner"
    mkdir -p "$dir"
    adb shell pm clear io.kaitech.mobile > /dev/null
    args=(
      test "$flow"
      -e APP_LANGUAGE=en -e DEVICE_SIZE=phone -e ORIENTATION=portrait
      "${signed_in[@]}" -e RUN="E2E$(date +%s)${RANDOM}"
      --format junit --output "$dir/junit.xml" --test-output-dir "$dir/raw"
    )
    case "$runner" in
      cli) command=(maestro "${args[@]}") ;;
      runner) command=(maestro-runner --no-ansi --platform android --driver "$driver" "${args[@]}") ;;
    esac
    echo "::group::$name with $runner"
    python3 -c "$measure_py" "$dir/stats.tsv" "${command[@]}" 2>&1 | tee -a "$console" || true
    echo "::endgroup::"
    printf '%s\t%s\t%s\n' "$name" "$runner" "$(cat "$dir/stats.tsv")" | tee -a "$out/results.tsv"
  done
done
adb shell pm list instrumentation | tr -d '\r' > "$out/instrumentation.txt" || true
adb logcat -d -b crash > "$out/crash.txt" || true
if [ -z "${E2E_LOGIN:-}" ]; then
  while IFS=$'\t' read -r name runner code _; do
    [ "$code" = 0 ] && continue
    mkdir -p "$out/$name/$runner/failures"
    find "$out/$name/$runner/raw" -name '*.png' -exec cp {} "$out/$name/$runner/failures/" \;
  done < <(tail -n +2 "$out/results.tsv")
fi

status=0
node scripts/e2e-runner-trial-summary.mjs "$out" "$(basename "$negative" .yaml)" || status=1
if [ -n "${GITHUB_STEP_SUMMARY:-}" ] && [ -f "$out/summary.md" ]; then
  cat "$out/summary.md" >> "$GITHUB_STEP_SUMMARY"
fi

if grep -q 'telemetry (debug, not sent)' "$console"; then
  echo "maestro-runner built a telemetry event: telemetry is on" >&2
  status=1
fi
{
  echo "MAESTRO_RUNNER_NO_TELEMETRY=${MAESTRO_RUNNER_NO_TELEMETRY:-unset} DO_NOT_TRACK=${DO_NOT_TRACK:-unset} MAESTRO_RUNNER_NO_UPDATE_CHECK=${MAESTRO_RUNNER_NO_UPDATE_CHECK:-unset} MAESTRO_RUNNER_TELEMETRY_DEBUG=${MAESTRO_RUNNER_TELEMETRY_DEBUG:-unset}"
  echo "telemetry events built: $(grep -c 'telemetry (debug, not sent)' "$console" || true)"
  echo "hosts: $(grep -F open.devicelab.dev /etc/hosts || echo 'no sink')"
} | tee "$out/telemetry.txt"

find "$out" -type d -name raw -prune -exec rm -rf {} +
for secret in "${E2E_LOGIN:-}" "${E2E_PASSWORD:-}" "${E2E_WEB_LOGIN:-}" "${E2E_WEB_PASSWORD:-}"; do
  [ -n "$secret" ] || continue
  if grep -rqF -- "$secret" "$out" || find "$out" | grep -F -- "$secret" > /dev/null; then
    echo "a test account value is in the trial output; it was not uploaded" >&2
    rm -rf "$out"
    status=1
    break
  fi
done

exit "$status"
