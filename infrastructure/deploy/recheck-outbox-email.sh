#!/usr/bin/env bash
# Recheck outbox event status for an email.
set -euo pipefail
EMAIL="${1:?usage: $0 <email>}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/postgres-target.sh
source "$SCRIPT_DIR/lib/postgres-target.sh"
EMAIL_ESC="${EMAIL//\'/\'\'}"
postgres_psql "$APP_NS" -d collabspace_auth -c \
  "SELECT attempt_count, claimed_at, processed_at, failed_at, left(coalesce(last_error,''),200) AS err FROM auth_outbox_events WHERE payload->>'email' = '${EMAIL_ESC}' ORDER BY created_at DESC LIMIT 1;"
kubectl logs -n "$APP_NS" deploy/auth-service --since=120s 2>/dev/null | grep -iE 'resend|email|timeout|failed|markFailed|sent' | tail -20 || true
