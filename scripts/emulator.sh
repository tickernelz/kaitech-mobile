#!/usr/bin/env bash
set -euo pipefail

usage="usage: emulator.sh run <phone|tablet> -- <command...> | status | stop"
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/android-sdk}}"
emulator_bin="$sdk/emulator/emulator"
avdmanager="$sdk/cmdline-tools/latest/bin/avdmanager"
image="system-images;android-35;google_apis;x86_64"
gpu="${KAITECH_EMULATOR_GPU:-host}"
idle_minutes="${KAITECH_EMULATOR_IDLE_MINUTES:-5}"
state="${XDG_RUNTIME_DIR:-/tmp}/kaitech-emulator"
unit=kaitech-emulator
reaper=kaitech-emulator-reap
port=5584
device="emulator-$port"
package=io.kaitech.mobile
mkdir -p "$state"

live_size() {
  if systemctl --user is-active -q "$unit"; then cat "$state/size" 2>/dev/null || true; fi
}
arm_reaper() {
  systemctl --user stop "$reaper.timer" 2>/dev/null || true
  systemd-run --user --collect -q -u "$reaper" \
    --on-active="${idle_minutes}m" --on-unit-inactive="${idle_minutes}m" \
    flock -n -E 0 "$state/lock" systemctl --user stop "$unit" "$reaper.timer" || true
}
booted() { [ "$(timeout 10 adb -s "$device" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; }
main_pid() { systemctl --user show -p MainPID --value "$unit" 2>/dev/null || echo 0; }

other_emulators() {
  local mine pid
  mine="$(main_pid)"
  for pid in $(pgrep -f 'qemu-system-[a-z0-9_]+' || true); do
    [ "$pid" = "$mine" ] && continue
    [ "$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')" = "$mine" ] && continue
    ps -o pid=,args= -p "$pid" 2>/dev/null | cut -c1-160
  done
}

ensure_avd() {
  local name="kaitech-$1" profile
  case "$1" in phone) profile=pixel_6 ;; tablet) profile=pixel_tablet ;; *) echo "$usage" >&2; exit 2 ;; esac
  [ -d "$HOME/.android/avd/$name.avd" ] || echo no | "$avdmanager" create avd -n "$name" -k "$image" -d "$profile" >&2
}

boot() {
  local size="$1" others
  systemctl --user stop "$unit" 2>/dev/null || true
  others="$(other_emulators)"
  if [ -n "$others" ]; then
    printf 'refusing to start a second emulator on this PC; already running:\n%s\nUse CI or the phone, or wait until it stops.\n' "$others" >&2
    exit 3
  fi
  ensure_avd "$size"
  echo "$size" > "$state/size"
  echo "booting kaitech-$size as $device (gpu $gpu)" >&2
  systemd-run --user --collect -q -u "$unit" -p Nice=10 -p CPUQuota=400% -p MemoryMax=8G \
    "$emulator_bin" -avd "kaitech-$size" -port "$port" -read-only -no-snapshot -gpu "$gpu" \
    -no-window -no-audio -no-boot-anim -no-metrics -camera-back none
  for _ in $(seq 1 150); do
    booted && break
    systemctl --user is-active -q "$unit" || break
    sleep 2
  done
  if ! booted; then
    journalctl --user -u "$unit" -n 30 --no-pager >&2 || true
    systemctl --user stop "$unit" 2>/dev/null || true
    echo "kaitech-$size did not boot on $device" >&2
    exit 1
  fi
  for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb -s "$device" shell settings put global "$scale" 0
  done
}

run() {
  local size="${1:?$usage}" status=0
  shift
  [ "${1:-}" = -- ] && shift
  [ "$#" -gt 0 ] || { echo "$usage" >&2; exit 2; }
  adb start-server >/dev/null 2>&1
  exec {lock}>"$state/lock"
  if ! flock -n "$lock"; then
    echo "the PC emulator is in use by another run; waiting for it" >&2
    flock "$lock"
  fi
  arm_reaper
  if [ "$(live_size)" != "$size" ] || ! booted; then
    boot "$size"
  elif adb -s "$device" shell pm path "$package" >/dev/null 2>&1; then
    adb -s "$device" shell pm clear "$package" >/dev/null
  fi
  echo "running on $device" >&2
  ANDROID_SERIAL="$device" nice -n 10 "$@" {lock}>&- || status=$?
  arm_reaper
  exit "$status"
}

status() {
  local use
  if flock -n "$state/lock" true; then use=free; else use=busy; fi
  echo "$device $(live_size | grep . || echo off) $use"
  other_emulators | sed 's/^/other emulator: /'
}

stop() {
  local rc=0
  [ -n "$(live_size)" ] || return 0
  flock -n -E 75 "$state/lock" systemctl --user stop "$unit" "$reaper.timer" || rc=$?
  [ "$rc" != 75 ] || echo "the emulator is busy, left running" >&2
  return "$rc"
}

case "${1:-}" in
  run) shift; run "$@" ;;
  status) status ;;
  stop) stop ;;
  *) echo "$usage" >&2; exit 2 ;;
esac
