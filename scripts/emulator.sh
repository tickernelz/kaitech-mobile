#!/usr/bin/env bash
set -euo pipefail

usage="usage: emulator.sh run <phone|tablet> -- <command...> | status | stop"
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/android-sdk}}"
emulator_bin="$sdk/emulator/emulator"
avdmanager="$sdk/cmdline-tools/latest/bin/avdmanager"
image="system-images;android-35;google_apis;x86_64"
slots="${KAITECH_EMULATOR_SLOTS:-3}"
gpu="${KAITECH_EMULATOR_GPU:-host}"
idle_minutes="${KAITECH_EMULATOR_IDLE_MINUTES:-5}"
state="${XDG_RUNTIME_DIR:-/tmp}/kaitech-emulator"
package=io.kaitech.mobile
mkdir -p "$state"

port() { echo $((5680 - 2 * $1)); }
serial() { echo "emulator-$(port "$1")"; }
unit() { echo "kaitech-emulator-$1"; }
live_size() {
  if systemctl --user is-active -q "$(unit "$1")"; then cat "$state/slot$1.size" 2>/dev/null || true; fi
}
booted() { [ "$(timeout 10 adb -s "$1" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; }

ensure_avd() {
  local name="kaitech-$1" device
  case "$1" in phone) device=pixel_6 ;; tablet) device=pixel_tablet ;; *) echo "$usage" >&2; exit 2 ;; esac
  exec {avd_lock}>"$state/avd.lock"
  flock "$avd_lock"
  [ -d "$HOME/.android/avd/$name.avd" ] || echo no | "$avdmanager" create avd -n "$name" -k "$image" -d "$device" >&2
  exec {avd_lock}>&-
}

acquire() {
  local wanted="$1" pass i current
  while :; do
    for pass in same empty other; do
      for i in $(seq 0 $((slots - 1))); do
        current="$(live_size "$i")"
        case "$pass" in
          same) [ "$current" = "$wanted" ] || continue ;;
          empty) [ -z "$current" ] || continue ;;
          other) [ -n "$current" ] && [ "$current" != "$wanted" ] || continue ;;
        esac
        exec {lock}>"$state/slot$i.lock"
        if flock -n "$lock"; then
          slot="$i"
          return
        fi
        exec {lock}>&-
      done
    done
    sleep 5
  done
}

boot() {
  local size="$1" device
  device="$(serial "$slot")"
  systemctl --user stop "$(unit "$slot")" 2>/dev/null || true
  ensure_avd "$size"
  echo "$size" > "$state/slot$slot.size"
  echo "booting kaitech-$size as $device (gpu $gpu)" >&2
  systemd-run --user --collect -q -u "$(unit "$slot")" -p Nice=10 -p CPUQuota=400% -p MemoryMax=8G \
    "$emulator_bin" -avd "kaitech-$size" -port "$(port "$slot")" -read-only -no-snapshot -gpu "$gpu" \
    -no-window -no-audio -no-boot-anim -no-metrics -camera-back none
  for _ in $(seq 1 150); do
    booted "$device" && break
    systemctl --user is-active -q "$(unit "$slot")" || break
    sleep 2
  done
  if ! booted "$device"; then
    journalctl --user -u "$(unit "$slot")" -n 30 --no-pager >&2 || true
    systemctl --user stop "$(unit "$slot")" 2>/dev/null || true
    echo "kaitech-$size did not boot on $device" >&2
    exit 1
  fi
  for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb -s "$device" shell settings put global "$scale" 0
  done
}

run() {
  local size="${1:?$usage}" device status=0
  shift
  [ "${1:-}" = -- ] && shift
  [ "$#" -gt 0 ] || { echo "$usage" >&2; exit 2; }
  adb start-server >/dev/null 2>&1
  acquire "$size"
  device="$(serial "$slot")"
  if [ "$(live_size "$slot")" != "$size" ] || ! booted "$device"; then
    boot "$size"
  elif adb -s "$device" shell pm path "$package" >/dev/null 2>&1; then
    adb -s "$device" shell pm clear "$package" >/dev/null
  fi
  echo "running on $device (slot $slot of $slots)" >&2
  ANDROID_SERIAL="$device" nice -n 10 "$@" {lock}>&- || status=$?
  systemctl --user stop "kaitech-emulator-reap-$slot.timer" 2>/dev/null || true
  systemd-run --user --collect -q -u "kaitech-emulator-reap-$slot" --on-active="${idle_minutes}m" \
    flock -n "$state/slot$slot.lock" systemctl --user stop "$(unit "$slot")" || true
  exit "$status"
}

status() {
  local i size use
  for i in $(seq 0 $((slots - 1))); do
    size="$(live_size "$i")"
    if flock -n "$state/slot$i.lock" true; then use=free; else use=busy; fi
    echo "slot $i $(serial "$i") ${size:-off} $use"
  done
}

stop() {
  local i
  for i in $(seq 0 $((slots - 1))); do
    [ -n "$(live_size "$i")" ] || continue
    flock -n -E 75 "$state/slot$i.lock" systemctl --user stop "$(unit "$i")" ||
      { [ "$?" = 75 ] && echo "slot $i is busy, left running" >&2; }
  done
}

case "${1:-}" in
  run) shift; run "$@" ;;
  status) status ;;
  stop) stop ;;
  *) echo "$usage" >&2; exit 2 ;;
esac
