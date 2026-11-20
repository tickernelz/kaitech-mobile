#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-ipad.sh <Kaitech.app built for the simulator> <output-dir>"
app="${1:?$usage}"
out="${2:?$usage}"
bundle_id=io.kaitech.mobile
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

boot() {
  xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b > /dev/null
}

status=0
for locale in en-US id-ID; do
  language="${locale%%-*}"
  boot
  xcrun simctl spawn "$udid" defaults write -g AppleLanguages -array "$language"
  xcrun simctl spawn "$udid" defaults write -g AppleLocale "${locale/-/_}"
  xcrun simctl shutdown "$udid"
  boot
  xcrun simctl install "$udid" "$app"

  for orientation in portrait landscape; do
    cell="tablet-$orientation-$locale"
    dir="$out/$cell"
    mkdir -p "$dir/screenshots"
    maestro --device "$udid" test ".maestro/shared/$orientation.yaml" > "$dir/rotate.log" 2>&1 || {
      echo "::error::$cell: setOrientation $orientation failed"
      cat "$dir/rotate.log"
      status=1
      continue
    }

    xcrun simctl io "$udid" recordVideo --codec=h264 --force "$dir/e2e-ipad-$cell.mp4" > /dev/null 2>&1 &
    recorder=$!
    sleep 2
    xcrun simctl terminate "$udid" "$bundle_id" 2> /dev/null || true
    xcrun simctl launch "$udid" "$bundle_id" > /dev/null
    sleep 1
    xcrun simctl io "$udid" screenshot "$dir/screenshots/start-tablet-$orientation-$language.png" > /dev/null

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
    node scripts/check-screenshots.mjs "$dir/screenshots" tablet "$orientation" "$language" || status=1
  done
  xcrun simctl shutdown "$udid"
done

[ -z "${created:-}" ] || xcrun simctl delete "$udid"
exit "$status"
