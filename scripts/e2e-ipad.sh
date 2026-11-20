#!/usr/bin/env bash
set -euo pipefail

usage="usage: e2e-ipad.sh <Kaitech.app built for the simulator> <output-dir>"
app="${1:?$usage}"
out="${2:?$usage}"
bundle_id=io.kaitech.mobile
mkdir -p "$out"

IFS=$'\t' read -r runtime device_type runtime_name device_name < <(
  xcrun simctl list -j runtimes | node -e '
    const { runtimes } = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const ios = runtimes
      .filter((r) => r.platform === "iOS" && r.isAvailable)
      .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
    const runtime = ios.at(-1);
    if (!runtime) throw new Error("no available iOS simulator runtime");
    const ipads = runtime.supportedDeviceTypes.filter((d) => d.name.startsWith("iPad"));
    console.error(`iPad device types in ${runtime.name}: ${ipads.map((d) => d.name).join(", ") || "none"}`);
    const device = ["iPad Pro 13", "iPad Pro 11", "iPad Air", "iPad"]
      .map((prefix) => ipads.find((d) => d.name.startsWith(prefix)))
      .find(Boolean);
    if (!device) throw new Error(`no iPad device type for ${runtime.name}`);
    console.log([runtime.identifier, device.identifier, runtime.name, device.name].join("\t"));
  '
)
udid="$(xcrun simctl create kaitech-ipad "$device_type" "$runtime")"
echo "simulator: $device_name, $runtime_name ($udid)" | tee "$out/simulator.txt"

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

xcrun simctl delete "$udid"
exit "$status"
