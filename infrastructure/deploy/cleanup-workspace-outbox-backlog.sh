#!/usr/bin/env bash
# Purge stuck workspace outbox rows (prod ops).
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
# shellcheck source=infrastructure/deploy/lib/postgres-target.sh
source "$(dirname "$0")/lib/postgres-target.sh"
PG_POD="$(postgres_primary_pod "$APP_NS")"
PGPASS="$(kubectl get secret workspace-service-secrets -n "$APP_NS" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"

echo "==> Releasing stale claimed workspace outbox rows..."
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_workspace -c \
  "UPDATE workspace_outbox_events
   SET claimed_at = NULL,
       available_at = NOW(),
       last_error = 'manual backlog cleanup',
       updated_at = NOW()
   WHERE processed_at IS NULL
     AND failed_at IS NULL
     AND claimed_at IS NOT NULL;"

echo "==> Purging failed workspace outbox rows..."
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_workspace -c \
  "DELETE FROM workspace_outbox_events
   WHERE processed_at IS NULL
     AND failed_at IS NOT NULL;"

echo "==> Purging remaining stuck unprocessed workspace outbox rows..."
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_workspace -c \
  "DELETE FROM workspace_outbox_events
   WHERE processed_at IS NULL;"

echo "==> Workspace outbox summary"
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_workspace -c \
  "SELECT count(*) FILTER (WHERE processed_at IS NULL AND failed_at IS NULL) AS pending,
          count(*) FILTER (WHERE claimed_at IS NOT NULL AND processed_at IS NULL) AS claimed
   FROM workspace_outbox_events;"

echo "Done."
