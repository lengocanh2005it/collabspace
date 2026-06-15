#!/usr/bin/env bash
# Network + env check for Brevo from auth-service pod.
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"

echo "=== Auth email env ==="
kubectl exec -n "$APP_NS" deploy/auth-service -- printenv EMAIL_DELIVERY_TIMEOUT_MS BREVO_SENDER_EMAIL 2>/dev/null

echo
echo "=== Curl Brevo API (HEAD) from auth pod ==="
kubectl exec -n "$APP_NS" deploy/auth-service -- wget -q -O /dev/null -S --timeout=10 https://api.brevo.com/v3/account 2>&1 | head -5 || true

echo
echo "=== Outbox stuck count ==="
PGPASS="$(kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -tAc \
  "SELECT count(*) FROM auth_outbox_events WHERE claimed_at IS NOT NULL AND processed_at IS NULL AND failed_at IS NULL;"
