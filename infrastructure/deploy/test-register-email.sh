#!/usr/bin/env bash
# Register + email delivery test on prod Droplet.
set -euo pipefail

EMAIL="${1:?usage: $0 <email>}"
FULL_NAME="${2:-Test User}"
PASSWORD="${3:-CollabTest2026!}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/postgres-target.sh
source "$SCRIPT_DIR/lib/postgres-target.sh"
EMAIL_ESC="${EMAIL//\'/\'\'}"

echo "=== POST /auth/register (${EMAIL}) ==="
REGISTER_RESP="$(curl -sS -w '\nHTTP:%{http_code}' -X POST http://127.0.0.1/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"fullName\":\"${FULL_NAME}\",\"password\":\"${PASSWORD}\"}")"
echo "$REGISTER_RESP"

sleep 12

echo
echo "=== Outbox for ${EMAIL} ==="
postgres_psql "$APP_NS" -d collabspace_auth -c \
  "SELECT event_type, attempt_count, claimed_at IS NOT NULL AS claimed, processed_at IS NOT NULL AS done, failed_at IS NOT NULL AS failed, left(coalesce(last_error,''),150) AS err, created_at FROM auth_outbox_events WHERE payload->>'email' = '${EMAIL_ESC}' ORDER BY created_at DESC LIMIT 3;"

echo
echo "=== Auth logs (last 60s) ==="
kubectl logs -n "$APP_NS" deploy/auth-service --since=90s 2>/dev/null \
  | grep -iE 'resend|email|outbox|error|sent|timeout|failed|register' | tail -30 || true

echo
echo "=== OTP from outbox ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo /opt/collabspace/infrastructure/deploy)"
if [[ -x "$SCRIPT_DIR/read-auth-otp-from-outbox.sh" ]]; then
  bash "$SCRIPT_DIR/read-auth-otp-from-outbox.sh" "$EMAIL" || true
else
  bash /opt/collabspace/infrastructure/deploy/read-auth-otp-from-outbox.sh "$EMAIL" || true
fi
echo
