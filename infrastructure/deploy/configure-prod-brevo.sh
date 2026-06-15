#!/usr/bin/env bash
# Cấu hình Brevo transactional email cho auth-service trên k3s (Vault → ESO → ConfigMap).
# Điền BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME trong phase0.env trước khi chạy.
#
#   export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
#   bash infrastructure/deploy/configure-prod-brevo.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/opt/collabspace}"
PHASE0_ENV="${PHASE0_ENV:-$APP_DIR/infrastructure/deploy/phase0.env}"
APP_NS="${APP_NS:-collabspace}"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

if [[ ! -f "$PHASE0_ENV" ]]; then
  echo "Missing $PHASE0_ENV — set BREVO_* variables first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$PHASE0_ENV"
set +a

if [[ -z "${BREVO_API_KEY:-}" || -z "${BREVO_SENDER_EMAIL:-}" ]]; then
  echo "BREVO_API_KEY and BREVO_SENDER_EMAIL must be set in $PHASE0_ENV"
  exit 1
fi

BREVO_SENDER_NAME="${BREVO_SENDER_NAME:-CollabSpace}"

echo "==> Seeding Vault KV (brevo_api_key)..."
bash "$APP_DIR/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh"

echo "==> Forcing ExternalSecret sync for auth-service..."
kubectl annotate externalsecret auth-service-secrets -n "$APP_NS" \
  "force-sync=$(date +%s)" --overwrite

echo "==> Waiting for auth-service-secrets refresh..."
for _ in $(seq 1 24); do
  if kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.BREVO_API_KEY}' 2>/dev/null | grep -q .; then
    break
  fi
  sleep 5
done

echo "==> Setting Brevo sender on auth-service ConfigMap..."
kubectl patch configmap auth-service-config -n "$APP_NS" --type merge \
  -p "{\"data\":{\"BREVO_SENDER_EMAIL\":\"${BREVO_SENDER_EMAIL}\",\"BREVO_SENDER_NAME\":\"${BREVO_SENDER_NAME}\",\"EMAIL_DELIVERY_TIMEOUT_MS\":\"15000\"}}"

echo "==> Restarting auth-service..."
kubectl rollout restart deployment/auth-service -n "$APP_NS"
kubectl rollout status deployment/auth-service -n "$APP_NS" --timeout=180s

echo "Brevo configured. Sender=${BREVO_SENDER_NAME} <${BREVO_SENDER_EMAIL}>"
echo "Test: register a new user and check inbox."
