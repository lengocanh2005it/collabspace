#!/usr/bin/env bash
# Run CollabSpace k6 scenarios against the API gateway.
# Usage:
#   BASE_URL=http://167.172.77.110/api/v1 ./run-load-test.sh smoke
#   BASE_URL=http://167.172.77.110/api/v1 ./run-load-test.sh demo-flow
# Optional Grafana markers (load-test dashboard):
#   GRAFANA_URL=http://167.172.77.110/grafana GRAFANA_PASSWORD=admin123 ./run-load-test.sh smoke
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SCENARIO="${1:-smoke}"
SCRIPT="$ROOT_DIR/k6/scenarios/${SCENARIO}.js"

if [[ ! -f "$SCRIPT" ]]; then
  echo "Unknown scenario: $SCENARIO" >&2
  echo "Available: smoke, demo-flow" >&2
  exit 1
fi

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 not found. Install: https://grafana.com/docs/k6/latest/set-up/install-k6/" >&2
  echo "Or use Docker: infrastructure/docker/docker-compose.loadtest.yml" >&2
  exit 1
fi

export BASE_URL="${BASE_URL:-http://localhost/api/v1}"
export K6_VUS="${K6_VUS:-}"
export K6_DURATION="${K6_DURATION:-}"
export GRAFANA_URL="${GRAFANA_URL:-}"
export GRAFANA_USER="${GRAFANA_USER:-admin}"
export GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-}"

echo "==> k6 scenario: $SCENARIO"
echo "    BASE_URL=$BASE_URL"
[[ -n "$GRAFANA_URL" ]] && echo "    GRAFANA_URL=$GRAFANA_URL (annotations on)"
echo ""

exec k6 run "$SCRIPT"
