#!/usr/bin/env bash
# Purge stuck demo outbox rows and optional orphan auth user (prod ops).
# Usage:
#   bash infrastructure/deploy/cleanup-auth-email-backlog.sh
#   bash infrastructure/deploy/cleanup-auth-email-backlog.sh --orphan-email lengocanhpyne363@gmail.com
set -euo pipefail

ORPHAN_EMAIL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --orphan-email)
      ORPHAN_EMAIL="${2:?}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
# shellcheck source=infrastructure/deploy/lib/postgres-target.sh
source "$(dirname "$0")/lib/postgres-target.sh"
PG_POD="$(postgres_primary_pod "$APP_NS")"
PGPASS="$(kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"

echo "==> Removing stuck demo outbox events..."
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "DELETE FROM auth_outbox_events
   WHERE processed_at IS NULL
     AND payload->>'email' LIKE 'demo-%@example.com';"

echo "==> Releasing stale claimed outbox rows (non-demo)..."
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "UPDATE auth_outbox_events
   SET claimed_at = NULL,
       available_at = NOW(),
       last_error = 'manual backlog cleanup',
       updated_at = NOW()
   WHERE processed_at IS NULL
     AND failed_at IS NULL
     AND claimed_at IS NOT NULL
     AND payload->>'email' NOT LIKE 'demo-%@example.com';"

echo "==> Purging permanently failed outbox rows (optional backlog)..."
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "DELETE FROM auth_outbox_events
   WHERE processed_at IS NULL
     AND failed_at IS NOT NULL
     AND payload->>'email' NOT LIKE 'demo-%@example.com';"

echo "==> Purging all other stuck unprocessed outbox rows (ops reset)..."
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "DELETE FROM auth_outbox_events
   WHERE processed_at IS NULL
     AND payload->>'email' NOT LIKE 'demo-%@example.com';"

if [[ -n "$ORPHAN_EMAIL" ]]; then
  EMAIL_ESC="${ORPHAN_EMAIL//\'/\'\'}"
  USER_ID="$(kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -tAc \
    "SELECT id::text FROM users WHERE email = '${EMAIL_ESC}' LIMIT 1;" | tr -d '[:space:]')"
  PROFILE_COUNT=0
  if [[ -n "$USER_ID" ]]; then
    PROFILE_COUNT="$(kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_user -tAc \
      "SELECT count(*)::text FROM profiles WHERE user_id = '${USER_ID}';" | tr -d '[:space:]')"
  fi
  if [[ -n "$USER_ID" && "${PROFILE_COUNT:-0}" == "0" ]]; then
    echo "==> Removing orphan auth user ${ORPHAN_EMAIL} (${USER_ID})"
    kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
      "DELETE FROM refresh_tokens WHERE user_id = '${USER_ID}';
       DELETE FROM user_roles WHERE user_id = '${USER_ID}';
       DELETE FROM users WHERE id = '${USER_ID}';"
  elif [[ -n "$USER_ID" ]]; then
    echo "Skip orphan delete: profile exists for ${ORPHAN_EMAIL}"
  else
    echo "No auth user for ${ORPHAN_EMAIL}"
  fi
fi

echo "==> Outbox summary"
kubectl exec -n "$APP_NS" "$PG_POD" -c postgres -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "SELECT count(*) FILTER (WHERE processed_at IS NULL AND failed_at IS NULL) AS pending,
          count(*) FILTER (WHERE claimed_at IS NOT NULL AND processed_at IS NULL) AS claimed
   FROM auth_outbox_events;"

echo "Done."
