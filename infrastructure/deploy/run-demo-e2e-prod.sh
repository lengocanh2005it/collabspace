#!/usr/bin/env bash
# Run MVP demo-e2e against a production k3s Droplet (OTP from auth outbox when SMTP is not set).
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

echo "==> Waiting for gateway readiness before demo E2E..."
bash "$SCRIPT_DIR/verify-k8s-readiness.sh"
echo "==> Brief stabilization for gRPC / RabbitMQ consumers..."
sleep 10

# On the Droplet, Traefik is reachable on loopback. Avoid overwriting BASE_URL with raw
# IPv6 node addresses (curl requires http://[ipv6]/...).
export BASE_URL="${BASE_URL:-http://127.0.0.1/api/v1}"
echo "==> Demo E2E BASE_URL=${BASE_URL}"
export DEMO_E2E_OTP_SCRIPT="${DEMO_E2E_OTP_SCRIPT:-$SCRIPT_DIR/read-auth-otp-from-outbox.sh}"
chmod +x "$DEMO_E2E_OTP_SCRIPT"

exec bash "$ROOT_DIR/scripts/demo-e2e.sh"
