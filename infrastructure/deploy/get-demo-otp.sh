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

if [[ -z "$EMAIL" ]]; then
  echo "Usage: get-demo-otp.sh <email>" >&2
  exit 1
fi

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

PG_POD=$(kubectl get pod -n "$APP_NS" -l app.kubernetes.io/name=postgresql \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [[ -z "$PG_POD" ]]; then
  echo "ERROR: Cannot find postgresql pod in namespace $APP_NS" >&2
  exit 1
fi

kubectl exec -n "$APP_NS" "$PG_POD" -- \
  bash -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U postgres -d collabspace_auth -t -A -c \
  \"SELECT payload->>'otp' FROM auth_outbox_events \
    WHERE event_type='auth.email_verification_otp' \
      AND payload->>'email'='${EMAIL}' \
    ORDER BY created_at DESC LIMIT 1;\""
