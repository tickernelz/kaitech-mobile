#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-call.sh <apk> <out-dir> <serial> <locale: en-US|id-ID> <size: phone|tablet> <orientation: portrait|landscape>"
apk="${1:?$usage}"
out="${2:?$usage}"
serial="${3:?$usage}"
locale="${4:?$usage}"
size="${5:?$usage}"
orientation="${6:?$usage}"
language="${locale%%-*}"

for name in CALL_SERVER CALL_DB CALL_LOGIN CALL_PASSWORD CALL_CHANNEL_ID SERVER LOGIN PASSWORD PEER; do
  [ -n "${!name:-}" ] || { echo "missing $name" >&2; exit 2; }
done

mkdir -p "$out"
export CALL_PEER_STATE="$out/call-peer.json"
export CALL_PEER_PORT="${CALL_PEER_PORT:-8765}"

cleanup() {
  node scripts/call-peer.mjs stop >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ "$orientation" = landscape ]; then rotation=1; else rotation=0; fi
adb -s "$serial" shell cmd window user-rotation lock "$rotation" >/dev/null
adb -s "$serial" install -r "$apk" | tail -1

activity="$(adb -s "$serial" shell cmd package resolve-activity --brief io.kaitech.mobile | tr -d '\r' | tail -1)"
recording="call-$size-$orientation-$locale.mp4"
adb -s "$serial" shell screenrecord --bit-rate 4000000 --time-limit 170 "/sdcard/$recording" &
recorder=$!
sleep 1

node scripts/call-peer.mjs start > "$out/peer-start.json"

status=0
maestro --device "$serial" test .maestro/signed-in/call.yaml \
  -e SERVER="$SERVER" -e LOGIN="$LOGIN" -e PASSWORD="$PASSWORD" -e PEER="$PEER" \
  -e APP_LANGUAGE="$language" -e DEVICE_SIZE="$size" -e ORIENTATION="$orientation" \
  --format junit --output "$out/junit.xml" --test-output-dir "$out/maestro" || status=$?

node scripts/call-peer.mjs logs > "$out/peer-logs.json" || true
node scripts/call-peer.mjs leave > "$out/peer-leave.json" || true
sleep 2
adb -s "$serial" shell pkill -INT screenrecord >/dev/null 2>&1 || true
wait "$recorder" || true
adb -s "$serial" pull "/sdcard/$recording" "$out/$recording" >/dev/null

app_uid="$(adb -s "$serial" shell cmd package list packages -U io.kaitech.mobile | tr -d '\r' | sed -n 's/.* uid:\([0-9]*\).*/\1/p' | head -1)"
adb -s "$serial" logcat -d -b main,crash --uid="$app_uid" > "$out/logcat.txt" || true
mkdir -p "$out/screenshots"
find "$out/maestro" -path '*/takeScreenshot/*.png' -exec cp {} "$out/screenshots/" \; 2>/dev/null || true
node scripts/check-screenshots.mjs "$out/screenshots" "$size" "$orientation" "$language" || status=1

exit "$status"
