# shellcheck shell=bash
hold_server() {
  [ -n "${E2E_LOGIN:-}" ] || return 0
  local line=''
  coproc LEASE { exec node scripts/e2e-lease.mjs "$1"; }
  lease_pid=$LEASE_PID
  read -r line <&"${LEASE[0]}" || true
  case "$line" in
    held* | unleased) ;;
    *)
      wait "$lease_pid" || true
      lease_pid=''
      echo "::error::no E2E lease on $E2E_SERVER, so the flows did not start" >&2
      return 1
      ;;
  esac
}

release_server() {
  [ -n "${lease_pid:-}" ] || return 0
  kill -TERM "$lease_pid" 2> /dev/null || true
  wait "$lease_pid" 2> /dev/null || true
  lease_pid=''
}
