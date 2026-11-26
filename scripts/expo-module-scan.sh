#!/usr/bin/env bash
set -euo pipefail

log="${1:?usage: expo-module-scan.sh <xcodebuild.log>}"
lines="$(grep -E 'Scanned [0-9]+ package roots for Expo modules|Scanning for Expo modules failed|EXPO_MODULES_SCAN_TIMEOUT_MS' "$log" | sort -u || true)"
if [ -z "$lines" ]; then
  echo "::warning::No Expo module scan line in $log; patches/expo-modules-autolinking+*.patch may not be applied."
  exit 0
fi
echo "$lines"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Expo module scan"
    echo
    while IFS= read -r line; do echo "- $line"; done <<< "$lines"
  } >> "$GITHUB_STEP_SUMMARY"
fi
