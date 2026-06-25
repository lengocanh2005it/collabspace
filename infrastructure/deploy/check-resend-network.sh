#!/usr/bin/env bash
# Network + env check for Resend from auth-service pod.
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
# shellcheck source=infrastructure/deploy/lib/postgres-target.sh
source "$(dirname "$0")/lib/postgres-target.sh"

echo "=== Auth email env ==="
kubectl exec -n "$APP_NS" deploy/auth-service -- printenv EMAIL_DELIVERY_TIMEOUT_MS RESEND_SENDER_EMAIL 2>/dev/null

echo
echo "=== Curl Resend API (HEAD) from auth pod ==="
kubectl exec -n "$APP_NS" deploy/auth-service -- wget -q -O /dev/null -S --timeout=10 https://api.resend.com 2>&1 | head -5 || true

echo
echo "=== Outbox stuck count ==="
PGPASS="$(kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
PG_POD="$(postgres_primary_pod "$APP_NS")"
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -tAc \
  "SELECT count(*) FROM auth_outbox_events WHERE claimed_at IS NOT NULL AND processed_at IS NULL AND failed_at IS NULL;"
