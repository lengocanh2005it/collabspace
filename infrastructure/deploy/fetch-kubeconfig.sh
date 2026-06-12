#!/usr/bin/env bash
# Copy kubeconfig từ Droplet k3s về máy local và thay 127.0.0.1 bằng IP public.
# Usage: ./fetch-kubeconfig.sh <DROPLET_IP> [ssh_user]
set -euo pipefail

DROPLET_HOST="${1:-}"
SSH_USER="${2:-root}"
OUT="${KUBECONFIG_OUT:-$HOME/.kube/collabspace-prod.yaml}"

if [[ -z "$DROPLET_HOST" ]]; then
  echo "Usage: $0 <DROPLET_IP> [ssh_user]"
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
scp "${SSH_USER}@${DROPLET_HOST}:/etc/rancher/k3s/k3s.yaml" "$OUT"

if [[ "$(uname -s)" == "Darwin" ]]; then
  sed -i '' "s/127.0.0.1/${DROPLET_HOST}/g" "$OUT"
else
  sed -i "s/127.0.0.1/${DROPLET_HOST}/g" "$OUT"
fi

chmod 600 "$OUT"
echo "Wrote $OUT"
echo "Use: export KUBECONFIG=$OUT"
echo "Test: kubectl get nodes"
