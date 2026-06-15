#!/usr/bin/env bash
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
PGPASS="$(kubectl get secret auth-service-secrets -n collabspace -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
kubectl exec -n collabspace postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "SELECT event_type, attempt_count, processed_at IS NOT NULL AS sent, failed_at IS NOT NULL AS failed, left(coalesce(last_error,''), 200) AS last_error, payload->>'email' AS email FROM auth_outbox_events ORDER BY created_at DESC LIMIT 8;"
