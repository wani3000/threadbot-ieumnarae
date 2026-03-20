#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEEKLY="30 8 * * 1 cd ${ROOT} && ./scripts/run_weekly.sh"
MORNING="0 7 * * * cd ${ROOT} && ./scripts/run_morning.sh"
DAILY="0 9 * * * cd ${ROOT} && ./scripts/run_daily.sh"

(
  crontab -l 2>/dev/null | rg -F -v "$ROOT" || true
  echo "CRON_TZ=Asia/Seoul"
  echo "$WEEKLY"
  echo "$MORNING"
  echo "$DAILY"
) | awk '!seen[$0]++' | crontab -

echo "Installed cron jobs (KST):"
crontab -l | rg -F -e "CRON_TZ=Asia/Seoul" -e "$ROOT"
