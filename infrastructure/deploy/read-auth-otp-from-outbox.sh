#!/usr/bin/env bash
# Read latest email verification OTP from auth_outbox_events (prod/demo when SMTP is not configured).
set -euo pipefail

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "usage: $0 <email>" >&2
  exit 1
fi

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/postgres-target.sh
source "$SCRIPT_DIR/lib/postgres-target.sh"

EMAIL_ESC="${EMAIL//\'/\'\'}"

postgres_psql "$APP_NS" -d collabspace_auth -tAc \
  "SELECT payload->>'otp' FROM auth_outbox_events WHERE event_type = 'auth.email_verification_otp' AND payload->>'email' = '${EMAIL_ESC}' ORDER BY created_at DESC LIMIT 1;" \
  | tr -d '[:space:]'
