#!/usr/bin/env bash
set -euo pipefail

version="${1:?usage: scripts/changelog-section.sh <version or vX.Y.Z tag>}"
version="${version#v}"
file="${CHANGELOG_FILE:-docs/changelog.md}"

section="$(awk -v head="## $version" '
  found && index($0, "## ") == 1 { exit }
  $0 == head || index($0, head " ") == 1 { found = 1; next }
  found { print }
' "$file" | sed -e '/./,$!d')"

if [ -z "$section" ]; then
  echo "::error file=$file::$file has no '## $version' section. Write it in the pull request that raises the version, then tag a commit of main that has it." >&2
  exit 1
fi

printf '%s\n' "$section"
