#!/usr/bin/env bash
set -euo pipefail

usage="usage: cache-summary.sh <writes: true|false> [<name> <step outcome> <cache-hit> <key> <matched key>]..."
writes="${1:?$usage}"
shift
[ $(( $# % 5 )) -eq 0 ] || { echo "$usage" >&2; exit 2; }

{
  echo "### Caches"
  echo
  echo "| Cache | Result | Key |"
  echo "|---|---|---|"
  while [ "$#" -gt 0 ]; do
    name="$1" outcome="$2" hit="$3" key="${4:--}" matched="$5"
    shift 5
    case "$outcome" in
      success)
        if [ "$hit" = true ]; then result=hit
        elif [ -n "$matched" ]; then result=partial key="$matched (wanted $key)"
        else result=miss
        fi
        ;;
      skipped|'') result="not used" ;;
      *) result="$outcome" ;;
    esac
    echo "| $name | $result | \`$key\` |"
  done
  echo
  if [ "$writes" = true ]; then
    echo "\`$GITHUB_REF\` writes the caches it missed."
  else
    echo "\`$GITHUB_REF\` only reads caches; they are written from \`refs/heads/main\`."
  fi
} >> "$GITHUB_STEP_SUMMARY"
