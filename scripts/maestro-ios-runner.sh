#!/usr/bin/env bash
set -euo pipefail

usage="usage: maestro-ios-runner.sh <build-dir>"
out="${1:?$usage}"
: "${MAESTRO_VERSION:?set by .github/actions/setup-maestro}"
: "${MAESTRO_SOURCE_COMMIT:?set by .github/actions/setup-maestro}"
patch="$(cd "$(dirname "$0")" && pwd)/maestro-ios-runner.patch"
jar="$(cd "$(dirname "$(command -v maestro)")/.." && pwd)/lib/maestro-ios-driver.jar"
products=driver-iPhoneSimulator

if [ ! -f "$out/$products/maestro-driver-ios-config.xctestrun" ]; then
  src="$(mktemp -d)"
  git clone -q --depth 1 --filter=blob:none --sparse --branch "$MAESTRO_VERSION" https://github.com/mobile-dev-inc/Maestro.git "$src"
  [ "$(git -C "$src" rev-parse HEAD)" = "$MAESTRO_SOURCE_COMMIT" ] || { echo "$MAESTRO_VERSION is not $MAESTRO_SOURCE_COMMIT" >&2; exit 1; }
  git -C "$src" sparse-checkout set maestro-ios-xctest-runner
  git -C "$src" apply "$patch"
  (cd "$src" && DESTINATION="generic/platform=iOS Simulator" DERIVED_DATA_DIR="$products" ARCHS=arm64 \
    ./maestro-ios-xctest-runner/build-maestro-ios-runner.sh > "$src/xcodebuild.log" 2>&1) || { tail -100 "$src/xcodebuild.log"; exit 1; }
  rm -rf "${out:?}/$products"
  mkdir -p "$out"
  cp -R "$src/maestro-ios-driver/src/main/resources/$products" "$out/"
  rm -rf "$src"
fi

(cd "$out" && zip -qr "$jar" "$products")
unzip -l "$jar" "$products/*"
