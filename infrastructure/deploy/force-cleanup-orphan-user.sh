#!/usr/bin/env bash
# Remove pending auth user + profile + outbox rows for an email (prod ops).
# Usage: bash infrastructure/deploy/force-cleanup-orphan-user.sh <email>
set -euo pipefail

EMAIL="${1:?usage: $0 <email>}"
EMAIL_ESC="${EMAIL//\'/\'\'}"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
PGPASS="$(kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"

USER_ID="$(kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -tAc \
  "SELECT id::text FROM users WHERE email = '${EMAIL_ESC}' LIMIT 1;" | tr -d '[:space:]')"

if [[ -z "$USER_ID" ]]; then
  echo "No auth user for ${EMAIL}"
  exit 0
fi

echo "==> Removing outbox events for ${EMAIL}"
kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "DELETE FROM auth_outbox_events WHERE payload->>'email' = '${EMAIL_ESC}';"

echo "==> Removing user-service profile for ${USER_ID}"
kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_user -c \
  "DELETE FROM user_preferences WHERE user_id = '${USER_ID}';
   DELETE FROM user_status WHERE user_id = '${USER_ID}';
   DELETE FROM profiles WHERE user_id = '${USER_ID}';"

echo "==> Removing auth user ${EMAIL} (${USER_ID})"
kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "DELETE FROM refresh_tokens WHERE user_id = '${USER_ID}';
   DELETE FROM user_roles WHERE user_id = '${USER_ID}';
   DELETE FROM users WHERE id = '${USER_ID}';"

echo "Done."
