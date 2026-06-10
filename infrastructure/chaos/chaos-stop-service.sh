#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-}"
if [[ -z "$SERVICE" ]]; then
  echo "Usage: $0 <container-name>  e.g. auth-service"
  exit 1
fi

echo "==> Stopping $SERVICE"
docker stop "$SERVICE" >/dev/null || true
sleep 3

echo "==> Run verify-readiness (expect failures)"
"$(dirname "$0")/../resilience/drills/verify-readiness.sh" || true

echo "==> Starting $SERVICE"
docker start "$SERVICE" >/dev/null
sleep 8

"$(dirname "$0")/../resilience/drills/verify-readiness.sh"
