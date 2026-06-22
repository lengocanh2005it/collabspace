#!/usr/bin/env bash
# get-demo-otp.sh <email>
# Reads the most recent OTP for <email> from the auth outbox DB.
# Used as DEMO_E2E_OTP_SCRIPT when running demo-e2e.sh on the Droplet.
#
# Usage:
#   export DEMO_E2E_OTP_SCRIPT=/opt/collabspace/infrastructure/deploy/get-demo-otp.sh
#   BASE_URL=http://<ip>/api/v1 bash scripts/demo-e2e.sh
set -euo pipefail

EMAIL="${1:-}"
APP_NS="${APP_NS:-collabspace}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/postgres-target.sh
source "$SCRIPT_DIR/lib/postgres-target.sh"

if [[ -z "$EMAIL" ]]; then
  echo "Usage: get-demo-otp.sh <email>" >&2
  exit 1
fi

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
EMAIL_ESC="${EMAIL//\'/\'\'}"
postgres_psql "$APP_NS" -d collabspace_auth -tAc \
  "SELECT payload->>'otp' FROM auth_outbox_events WHERE event_type = 'auth.email_verification_otp' AND payload->>'email' = '${EMAIL_ESC}' ORDER BY created_at DESC LIMIT 1;"
