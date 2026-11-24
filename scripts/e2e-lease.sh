# shellcheck shell=bash
hold_server() {
  [ -n "${E2E_LOGIN:-}" ] || return 0
  local line='' pipes
  pipes="$(mktemp -d)"
  mkfifo "$pipes/in" "$pipes/out"
  node scripts/e2e-lease.mjs "$1" < "$pipes/in" > "$pipes/out" &
  lease_pid=$!
  exec 8> "$pipes/in" 9< "$pipes/out"
  rm -rf "$pipes"
  read -r line <&9 || true
  case "$line" in
    held* | unleased) ;;
    *)
      release_server
      echo "::error::no E2E lease on $E2E_SERVER, so the flows did not start" >&2
      return 1
      ;;
  esac
}

release_server() {
  [ -n "${lease_pid:-}" ] || return 0
  kill -TERM "$lease_pid" 2> /dev/null || true
  wait "$lease_pid" 2> /dev/null || true
  exec 8>&- 9<&-
  lease_pid=''
}
