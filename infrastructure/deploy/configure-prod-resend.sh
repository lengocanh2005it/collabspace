#!/usr/bin/env bash
# Configure Resend transactional email for auth-service on k3s (Vault -> ESO -> ConfigMap).
# Fill RESEND_API_KEY, RESEND_SENDER_EMAIL, RESEND_SENDER_NAME in phase0.env before running.
#
#   export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
#   bash infrastructure/deploy/configure-prod-resend.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/collabspace}"
PHASE0_ENV="${PHASE0_ENV:-$APP_DIR/infrastructure/deploy/phase0.env}"
APP_NS="${APP_NS:-collabspace}"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

if [[ ! -f "$PHASE0_ENV" ]]; then
  echo "Missing $PHASE0_ENV - set RESEND_* variables first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$PHASE0_ENV"
set +a

if [[ -z "${RESEND_API_KEY:-}" || -z "${RESEND_SENDER_EMAIL:-}" ]]; then
  echo "RESEND_API_KEY and RESEND_SENDER_EMAIL must be set in $PHASE0_ENV"
  exit 1
fi

RESEND_SENDER_NAME="${RESEND_SENDER_NAME:-CollabSpace}"

echo "==> Seeding Vault KV (resend_api_key)..."
bash "$APP_DIR/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh"

echo "==> Forcing ExternalSecret sync for auth-service..."
kubectl annotate externalsecret auth-service-secrets -n "$APP_NS" \
  "force-sync=$(date +%s)" --overwrite

echo "==> Waiting for auth-service-secrets refresh..."
for _ in $(seq 1 24); do
  if kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.RESEND_API_KEY}' 2>/dev/null | grep -q .; then
    break
  fi
  sleep 5
done

echo "==> Setting Resend sender on auth-service ConfigMap..."
kubectl patch configmap auth-service-config -n "$APP_NS" --type merge \
  -p "{\"data\":{\"RESEND_SENDER_EMAIL\":\"${RESEND_SENDER_EMAIL}\",\"RESEND_SENDER_NAME\":\"${RESEND_SENDER_NAME}\",\"EMAIL_DELIVERY_TIMEOUT_MS\":\"15000\"}}"

echo "==> Restarting auth-service..."
kubectl rollout restart deployment/auth-service -n "$APP_NS"
kubectl rollout status deployment/auth-service -n "$APP_NS" --timeout=180s

echo "Resend configured. Sender=${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>"
echo "Test: register a new user and check inbox."
