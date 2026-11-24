#!/usr/bin/env bash
set -euo pipefail

count="${E2E_ACCOUNTS:-1}"
case "$count" in
  '' | *[!0-9]*) echo "::error::KAITECH_E2E_ACCOUNTS must be a positive whole number, got '$count'"; exit 1 ;;
esac
count=$((10#$count))
if [ "$count" -lt 1 ]; then
  echo "::error::KAITECH_E2E_ACCOUNTS must be a positive whole number, got '$E2E_ACCOUNTS'"
  exit 1
fi

account="${E2E_ACCOUNT:-}"
if [ -z "$account" ]; then
  if [ "$count" -eq 1 ]; then
    account=0
  else
    account=$((1 + RUN_NUMBER % (count - 1)))
  fi
fi
case "$account" in
  *[!0-9]*) echo "::error::account must be a whole number, got '$account'"; exit 1 ;;
esac
account=$((10#$account))
if [ "$account" -ge "$count" ]; then
  echo "::error::account $account is not below KAITECH_E2E_ACCOUNTS=$count"
  exit 1
fi

if [ "$account" -eq 0 ]; then
  suffix=''
  group=''
else
  suffix="_$account"
  group="$account-"
fi

echo "E2E test account: $account of $count"
{
  echo "account=$account"
  echo "suffix=$suffix"
  echo "group=$group"
} >> "$GITHUB_OUTPUT"
