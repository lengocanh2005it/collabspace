#!/usr/bin/env bash
# Smoke k6 against production/staging gateway (low VU — not a full load test).
set -euo pipefail

export BASE_URL="${BASE_URL:-http://167.172.77.110/api/v1}"
export K6_VUS="${K6_VUS:-5}"
export K6_DURATION="${K6_DURATION:-1m}"
export GRAFANA_URL="${GRAFANA_URL:-http://167.172.77.110/grafana}"
export GRAFANA_USER="${GRAFANA_USER:-admin}"
export GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin123}"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec bash "$SCRIPT_DIR/../load-testing/run-load-test.sh" smoke
