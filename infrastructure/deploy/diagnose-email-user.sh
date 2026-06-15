#!/usr/bin/env bash
set -euo pipefail
EMAIL="${1:?}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
PGPASS="$(kubectl get secret auth-service-secrets -n collabspace -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
EMAIL_ESC="${EMAIL//\'/\'\'}"
echo "=== users ==="
kubectl exec -n collabspace postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "SELECT id, email, email_verified_at, created_at FROM users WHERE email = '${EMAIL_ESC}';"
echo "=== profiles (by user_id from auth if any) ==="
kubectl exec -n collabspace postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_user -c \
  "SELECT p.id, p.user_id, p.username, p.full_name, p.display_name FROM profiles p JOIN (SELECT id FROM dblink('dbname=collabspace_auth', 'SELECT id::text FROM users WHERE email = ''${EMAIL_ESC}''') AS t(id uuid)) u ON p.user_id = u.id;" 2>&1 || \
kubectl exec -n collabspace postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_user -c \
  "SELECT id, user_id, username, full_name FROM profiles WHERE username ILIKE '%lengocanh%' OR full_name ILIKE '%Le Ngoc%' LIMIT 10;"
