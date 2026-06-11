#!/usr/bin/env bash
set -euo pipefail

declare -A ENDPOINTS=(
  ["auth"]="http://localhost:3000/api/v1/auth/health/ready"
  ["user"]="http://localhost:3001/api/v1/users/health/ready"
  ["workspace"]="http://localhost:3002/api/v1/workspaces/health/ready"
  ["task"]="http://localhost:3003/api/v1/tasks/health/ready"
  ["notification"]="http://localhost:3004/api/v1/notifications/health/ready"
)

failures=0

for name in "${!ENDPOINTS[@]}"; do
  url="${ENDPOINTS[$name]}"
  code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")"
  if [[ "$code" == "200" ]]; then
    echo "[OK]   $name ($code) $url"
  else
    echo "[FAIL] $name ($code) $url"
    failures=$((failures + 1))
  fi
done

if [[ "$failures" -gt 0 ]]; then
  echo "Readiness drill failed: $failures service(s) not ready."
  exit 1
fi

echo "All services report ready."
