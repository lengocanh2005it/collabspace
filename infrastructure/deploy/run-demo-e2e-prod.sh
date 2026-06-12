#!/usr/bin/env bash
# Run MVP demo-e2e against a production k3s Droplet (OTP from auth outbox when SMTP is not set).
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

export BASE_URL="${BASE_URL:-http://127.0.0.1/api/v1}"
export DEMO_E2E_OTP_SCRIPT="${DEMO_E2E_OTP_SCRIPT:-$SCRIPT_DIR/read-auth-otp-from-outbox.sh}"
chmod +x "$DEMO_E2E_OTP_SCRIPT"

exec bash "$ROOT_DIR/scripts/demo-e2e.sh"
