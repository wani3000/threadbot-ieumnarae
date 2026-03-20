#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate
STREAMLIT_BROWSER_GATHER_USAGE_STATS=false \
  .venv/bin/python -m streamlit run src/threadbot/dashboard.py "$@"
