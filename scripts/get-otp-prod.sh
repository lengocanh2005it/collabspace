#!/usr/bin/env bash
# Usage: get-otp-prod.sh <email>
# Retrieves the latest email verification OTP for <email> from auth_outbox_events
# via kubectl exec into the postgres pod. Requires kubeconfig to be configured.
set -euo pipefail

EMAIL="${1:?Usage: get-otp-prod.sh <email>}"

kubectl exec -n collabspace postgres-0 -- \
  psql -U postgres -d collabspace_auth -t -A -c \
  "SELECT payload->>'otp'
   FROM auth_outbox_events
   WHERE event_type = 'auth.email_verification_otp'
     AND payload->>'email' = '${EMAIL}'
   ORDER BY created_at DESC
   LIMIT 1"
