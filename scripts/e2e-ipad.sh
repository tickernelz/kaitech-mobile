#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-ipad.sh <Kaitech.app built for the simulator> <output-dir>"
app="${1:?$usage}"
out="${2:?$usage}"
mkdir -p "$out"

IFS=$'\t' read -r udid device_name runtime_name < <(
  xcrun simctl list -j | node -e '
    const { devices, devicetypes, runtimes } = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const ios = runtimes
      .filter((r) => r.platform === "iOS" && r.isAvailable)
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
    const preference = ["iPad Pro 13", "iPad Pro 11", "iPad Air", "iPad"];
    const byPreference = (list) => preference.map((p) => list.find((d) => d.name.startsWith(p))).find(Boolean);
    console.error(`iOS runtimes: ${ios.map((r) => r.name).join(", ") || "none"}`);
    for (const runtime of ios) {
      const existing = (devices[runtime.identifier] ?? []).filter((d) => d.isAvailable && d.name.startsWith("iPad"));
      console.error(`${runtime.name} iPads: ${existing.map((d) => d.name).join(", ") || "none"}`);
      const device = byPreference(existing);
      if (device) {
        console.log([device.udid, device.name, runtime.name].join("\t"));
        process.exit(0);
      }
    }
    const type = byPreference(devicetypes.filter((d) => d.name.startsWith("iPad")));
    if (!type || ios.length === 0) throw new Error("no iPad simulator device type or iOS runtime on this runner");
    console.log(["create:" + type.identifier + ":" + ios[0].identifier, type.name, ios[0].name].join("\t"));
  '
)
if [[ "$udid" == create:* ]]; then
  IFS=: read -r _ device_type runtime <<< "$udid"
  udid="$(xcrun simctl create kaitech-ipad "$device_type" "$runtime")"
  created=1
fi
xcrun simctl shutdown "$udid" 2> /dev/null || true
echo "simulator: $device_name, $runtime_name" | tee "$out/simulator.txt"

log() { echo "$(date -u +%T) $*"; }

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
for locale in en-US id-ID; do
  language="${locale%%-*}"
  set_language "$language" "${locale/-/_}"
  boot
  xcrun simctl install "$udid" "$app"
  log "installed"

  for orientation in portrait landscape; do
    cell="tablet-$orientation-$locale"
    dir="$out/$cell"
    mkdir -p "$dir/screenshots"
    log "$cell: start"
    xcrun simctl io "$udid" recordVideo --codec=h264 --force "$dir/e2e-ipad-$cell.mp4" > /dev/null 2>&1 &
    recorder=$!
    sleep 2

    maestro --device "$udid" test .maestro \
      -e APP_LANGUAGE="$language" \
      -e DEVICE_SIZE=tablet \
      -e ORIENTATION="$orientation" \
      --format junit \
      --output "$dir/junit.xml" \
      --test-output-dir "$dir/maestro" || status=1

    kill -INT "$recorder" 2> /dev/null || true
    wait "$recorder" || true

    find "$dir/maestro" -path '*/takeScreenshot/*.png' -exec cp {} "$dir/screenshots/" \;
    find "$dir/maestro" -name device-simulator.log -delete
    log "$cell: done"
    node scripts/check-screenshots.mjs "$dir/screenshots" tablet "$orientation" "$language" || status=1
  done
  xcrun simctl shutdown "$udid"
  log "shut down"
done

[ -z "${created:-}" ] || xcrun simctl delete "$udid"
exit "$status"
