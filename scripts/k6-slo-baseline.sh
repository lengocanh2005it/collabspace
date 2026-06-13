#!/usr/bin/env bash
# Run the CollabSpace k6 SLO baseline against the API gateway.
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

export BASE_URL="${BASE_URL:-http://localhost/api/v1}"
export K6_VUS="${K6_VUS:-10}"
export K6_DURATION="${K6_DURATION:-2m}"

exec "$ROOT_DIR/infrastructure/load-testing/run-load-test.sh" slo-baseline
