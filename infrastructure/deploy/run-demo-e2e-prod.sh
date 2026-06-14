#!/usr/bin/env bash
# Run MVP demo-e2e against a production k3s Droplet (OTP from auth outbox when SMTP is not set).
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

# Guard on empty IP resolution
DROPLET_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || true)
if [[ -z "$DROPLET_IP" ]]; then
  DROPLET_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)
fi

if [[ -z "$DROPLET_IP" ]]; then
  echo "ERROR: Could not resolve Droplet IP via kubectl. Is kubeconfig set?" >&2
  exit 1
fi

export BASE_URL="${BASE_URL:-http://${DROPLET_IP}/api/v1}"
export DEMO_E2E_OTP_SCRIPT="${DEMO_E2E_OTP_SCRIPT:-$SCRIPT_DIR/read-auth-otp-from-outbox.sh}"
chmod +x "$DEMO_E2E_OTP_SCRIPT"

exec bash "$ROOT_DIR/scripts/demo-e2e.sh"
