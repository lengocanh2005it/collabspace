#!/usr/bin/env bash
# Cấu hình Gmail SMTP cho auth-service trên k3s (Vault → ESO → ConfigMap).
# Điền MAIL_USER / MAIL_PASSWORD trong phase0.env trước khi chạy.
#
#   export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
#   bash infrastructure/deploy/configure-prod-gmail.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/opt/collabspace}"
PHASE0_ENV="${PHASE0_ENV:-$APP_DIR/infrastructure/deploy/phase0.env}"
APP_NS="${APP_NS:-collabspace}"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

if [[ ! -f "$PHASE0_ENV" ]]; then
  echo "Missing $PHASE0_ENV — set MAIL_USER and MAIL_PASSWORD first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$PHASE0_ENV"
set +a

if [[ -z "${MAIL_USER:-}" || -z "${MAIL_PASSWORD:-}" ]]; then
  echo "MAIL_USER and MAIL_PASSWORD must be set in $PHASE0_ENV"
  exit 1
fi

MAIL_FROM="${MAIL_FROM:-$MAIL_USER}"

echo "==> Seeding Vault KV (mail_user / mail_password)..."
bash "$APP_DIR/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh"

echo "==> Forcing ExternalSecret sync for auth-service..."
kubectl annotate externalsecret auth-service-secrets -n "$APP_NS" \
  "force-sync=$(date +%s)" --overwrite

echo "==> Waiting for auth-service-secrets refresh..."
for _ in $(seq 1 24); do
  if kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.MAIL_USER}' 2>/dev/null | grep -q .; then
    break
  fi
  sleep 5
done

echo "==> Setting MAIL_FROM on auth-service ConfigMap..."
kubectl patch configmap auth-service-config -n "$APP_NS" --type merge \
  -p "{\"data\":{\"MAIL_FROM\":\"${MAIL_FROM}\",\"MAIL_HOST\":\"smtp.gmail.com\",\"MAIL_PORT\":\"587\",\"MAIL_SECURE\":\"false\",\"MAIL_IGNORE_TLS\":\"false\"}}"

echo "==> Restarting auth-service..."
kubectl rollout restart deployment/auth-service -n "$APP_NS"
kubectl rollout status deployment/auth-service -n "$APP_NS" --timeout=180s

echo "Gmail SMTP configured. MAIL_FROM=${MAIL_FROM}"
echo "Test: register a new user and check inbox (or auth_outbox_events if delivery fails)."
