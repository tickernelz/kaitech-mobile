#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-ios.sh <Kaitech.app built for the simulator> <output-dir> <locale: en-US|id-ID> <family: ipad|iphone>"
app="${1:?$usage}"
out="${2:?$usage}"
locale="${3:?$usage}"
family="${4:?$usage}"
case "$family" in
  ipad) size=tablet; preference='["iPad Pro 13", "iPad Pro 11", "iPad Air", "iPad"]'; orientations="${ORIENTATIONS:-portrait landscape}" ;;
  iphone) size=phone; preference='["iPhone 17 Pro", "iPhone 17", "iPhone 16 Pro", "iPhone 16", "iPhone"]'; orientations="${ORIENTATIONS:-portrait}" ;;
  *) echo "$usage" >&2; exit 2 ;;
esac
appearances="${APPEARANCES:-light}"
min_ios="${MIN_IOS:-0}"
read -ra flows <<< "${E2E_FLOWS:-.maestro}"
language="${locale%%-*}"
mkdir -p "$out"

IFS=$'\t' read -r udid device_name runtime_name < <(
  xcrun simctl list -j | PREFERENCE="$preference" FAMILY="$family" MIN_IOS="$min_ios" node -e '
    const { devices, devicetypes, runtimes } = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const family = process.env.FAMILY === "ipad" ? "iPad" : "iPhone";
    const minimum = Number(process.env.MIN_IOS);
    const ios = runtimes
      .filter((r) => r.platform === "iOS" && r.isAvailable && Number.parseFloat(r.version) >= minimum)
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
    const preference = JSON.parse(process.env.PREFERENCE);
    const byPreference = (list) => preference.map((p) => list.find((d) => d.name.startsWith(p))).find(Boolean);
    console.error(`iOS runtimes from ${minimum}: ${ios.map((r) => r.name).join(", ") || "none"}`);
    for (const runtime of ios) {
      const existing = (devices[runtime.identifier] ?? []).filter((d) => d.isAvailable && d.name.startsWith(family));
      console.error(`${runtime.name} ${family}s: ${existing.map((d) => d.name).join(", ") || "none"}`);
      const device = byPreference(existing);
      if (device) {
        console.log([device.udid, device.name, runtime.name].join("\t"));
        process.exit(0);
      }
    }
    const type = byPreference(devicetypes.filter((d) => d.name.startsWith(family)));
    if (!type || ios.length === 0) throw new Error(`no ${family} simulator device type or iOS ${minimum}+ runtime on this runner`);
    console.log(["create:" + type.identifier + ":" + ios[0].identifier, type.name, ios[0].name].join("\t"));
  '
)
if [[ "$udid" == create:* ]]; then
  IFS=: read -r _ device_type runtime <<< "$udid"
  udid="$(xcrun simctl create "kaitech-$family" "$device_type" "$runtime")"
  created=1
fi
xcrun simctl shutdown "$udid" 2> /dev/null || true
echo "simulator: $device_name, $runtime_name" | tee "$out/simulator.txt"

log() { echo "$(date -u +%T) $*"; }

export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-600000}"

signed_in=()
if [ -n "${E2E_LOGIN:-}" ]; then
  signed_in=(
    -e LOGIN="$E2E_LOGIN" -e PASSWORD="$E2E_PASSWORD"
    -e SERVER="$E2E_SERVER" -e DB="$E2E_DB"
  )
fi

run_flows() {
  rm -rf "$dir/maestro" "$dir/junit.xml"
  maestro --device "$udid" test "${flows[@]}" \
    -e APP_LANGUAGE="$language" \
    -e DEVICE_SIZE="$size" \
    -e ORIENTATION="$orientation" \
    -e APPEARANCE="$appearance" \
    ${signed_in[@]+"${signed_in[@]}"} \
    --format junit \
    --output "$dir/junit.xml" \
    --test-output-dir "$dir/maestro" 2>&1 | tee "$dir/maestro-console.log"
}

boot() {
  log "boot $udid"
  xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b > /dev/null
  log "booted"
}

set_language() {
  local prefs="$HOME/Library/Developer/CoreSimulator/Devices/$udid/data/Library/Preferences/.GlobalPreferences.plist"
  mkdir -p "$(dirname "$prefs")"
  [ -f "$prefs" ] || printf '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict/></plist>\n' > "$prefs"
  plutil -replace AppleLanguages -json "[\"$1\"]" "$prefs"
  plutil -replace AppleLocale -string "$2" "$prefs"
}

status=0
set_language "$language" "${locale/-/_}"
boot
xcrun simctl install "$udid" "$app"
log "installed"

for appearance in $appearances; do
  xcrun simctl ui "$udid" appearance "$appearance"
  for orientation in $orientations; do
    cell="$size-$orientation-$locale"
    [ "$appearances" = light ] || cell="$cell-$appearance"
    dir="$out/$cell"
    mkdir -p "$dir/screenshots"
    log "$cell: start"
    xcrun simctl io "$udid" recordVideo --codec=h264 --force "$dir/e2e-$family-$cell.mp4" > /dev/null 2>&1 &
    recorder=$!
    sleep 2

    if ! run_flows; then
      if grep -q IOSDriverTimeoutException "$dir/maestro-console.log"; then
        log "$cell: iOS driver not ready in time, retrying once"
        mv "$dir/maestro-console.log" "$dir/maestro-console-attempt1.log"
        run_flows || status=1
      else
        status=1
      fi
    fi

    kill -INT "$recorder" 2> /dev/null || true
    wait "$recorder" || true

    find "$dir/maestro" -path '*/takeScreenshot/*.png' -exec cp {} "$dir/screenshots/" \;
    find "$dir/maestro" -name device-simulator.log -delete
    log "$cell: done"
    node scripts/check-screenshots.mjs "$dir/screenshots" "$size" "$orientation" "$language" || status=1
    if [ -n "${E2E_LOGIN:-}" ]; then
      mkdir -p "$dir/failures"
      find "$dir/maestro" -path '*/screenshots/*.png' ! -name '*runFlow*' ! -iname '*email*' ! -iname '*password*' ! -iname '*sandi*' ! -iname '*sign*in*' ! -iname '*masuk*' ! -iname '*login*' -exec cp {} "$dir/failures/" \;
      find "$dir" -mindepth 1 -maxdepth 1 ! -name junit.xml ! -name screenshots ! -name failures -exec rm -rf {} +
    fi
  done
done
xcrun simctl shutdown "$udid"
log "shut down"

if [ -n "${E2E_LOGIN:-}" ]; then
  for secret in "$E2E_LOGIN" "$E2E_PASSWORD"; do
    if grep -rqF -- "$secret" "$out" || find "$out" | grep -F -- "$secret" > /dev/null; then
      echo "a test account value is in the E2E output; it was not uploaded" >&2
      rm -rf "$out"
      status=1
      break
    fi
  done
fi

[ -z "${created:-}" ] || xcrun simctl delete "$udid"
exit "$status"
