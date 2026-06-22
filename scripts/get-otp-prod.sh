#!/usr/bin/env bash
# Usage: get-otp-prod.sh <email>
# Retrieves the latest email verification OTP for <email> from auth_outbox_events
# via kubectl exec into the postgres pod. Requires kubeconfig to be configured.
set -euo pipefail

EMAIL="${1:?Usage: get-otp-prod.sh <email>}"

PG_POD="$(kubectl get cluster postgres -n collabspace \
  -o jsonpath='{.status.currentPrimary}' 2>/dev/null || true)"

if [[ -z "$PG_POD" ]]; then
  # Fallback: pick any running postgres pod
  PG_POD="$(kubectl get pods -n collabspace -l cnpg.io/cluster=postgres \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
fi

if [[ -z "$PG_POD" ]]; then
  echo "ERROR: cannot find postgres pod" >&2
  exit 1
fi

kubectl exec -n collabspace "$PG_POD" -c postgres -- \
  psql -U postgres -d collabspace_auth -t -A -c \
  "SELECT payload->>'otp'
   FROM auth_outbox_events
   WHERE event_type = 'auth.email_verification_otp'
     AND payload->>'email' = '${EMAIL}'
   ORDER BY created_at DESC
   LIMIT 1"
