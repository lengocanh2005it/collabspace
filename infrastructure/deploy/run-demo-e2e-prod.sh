#!/usr/bin/env bash
# Run MVP demo-e2e against a production k3s Droplet.
# Register step needs Brevo (BREVO_API_KEY) or OTP fallback via read-auth-otp-from-outbox.sh.
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

echo "==> Waiting for gateway readiness before demo E2E..."
bash "$SCRIPT_DIR/verify-k8s-readiness.sh"
echo "==> Brief stabilization for gRPC / RabbitMQ consumers..."
sleep "${E2E_STABILIZATION_SEC:-20}"

if kubectl get deployment auth-service -n "${APP_NS:-collabspace}" >/dev/null 2>&1; then
  if ! kubectl exec -n "${APP_NS:-collabspace}" deploy/auth-service -- sh -c 'test -n "$BREVO_API_KEY"' 2>/dev/null; then
    echo "WARN: BREVO_API_KEY missing on auth-service — demo E2E will rely on OTP outbox fallback."
  else
    echo "Brevo email delivery configured on auth-service."
  fi
fi

# On the Droplet, Traefik is reachable on loopback. Avoid overwriting BASE_URL with raw
# IPv6 node addresses (curl requires http://[ipv6]/...).
export BASE_URL="${BASE_URL:-http://127.0.0.1/api/v1}"
echo "==> Demo E2E BASE_URL=${BASE_URL}"
export DEMO_E2E_OTP_SCRIPT="${DEMO_E2E_OTP_SCRIPT:-$SCRIPT_DIR/read-auth-otp-from-outbox.sh}"
chmod +x "$DEMO_E2E_OTP_SCRIPT"

exec bash "$ROOT_DIR/scripts/demo-e2e.sh"
