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

PGPASS="$(kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
EMAIL_ESC="${EMAIL//\'/\'\'}"

kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -tAc \
  "SELECT payload->>'otp' FROM auth_outbox_events WHERE event_type = 'auth.email_verification_otp' AND payload->>'email' = '${EMAIL_ESC}' ORDER BY created_at DESC LIMIT 1;" \
  | tr -d '[:space:]'
