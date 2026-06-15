#!/usr/bin/env bash
# Recheck outbox event status for an email.
set -euo pipefail
EMAIL="${1:?usage: $0 <email>}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
EMAIL_ESC="${EMAIL//\'/\'\'}"
PGPASS="$(kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "SELECT attempt_count, claimed_at, processed_at, failed_at, left(coalesce(last_error,''),200) AS err FROM auth_outbox_events WHERE payload->>'email' = '${EMAIL_ESC}' ORDER BY created_at DESC LIMIT 1;"
kubectl logs -n "$APP_NS" deploy/auth-service --since=120s 2>/dev/null | grep -iE 'brevo|email|timeout|failed|markFailed|sent' | tail -20 || true
