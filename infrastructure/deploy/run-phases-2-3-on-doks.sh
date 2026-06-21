#!/usr/bin/env bash
# Chạy trên Droplet (root) sau Phase 1 + đã upload phase0.env + values-prod.yaml.
#   sudo bash infrastructure/deploy/run-phases-2-3-on-doks.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/collabspace}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo)."
  exit 1
fi

cd "$APP_DIR"

PHASE0="$APP_DIR/infrastructure/deploy/phase0.env"
VALUES_PROD="$APP_DIR/infrastructure/helm/collabspace/values-prod.yaml"

for f in "$PHASE0" "$VALUES_PROD"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing $f — upload from laptop first (upload-prod-config-to-doks.ps1)."
    exit 1
  fi
done

echo "==> Phase 2: Vault + ESO"
bash "$APP_DIR/infrastructure/deploy/vault-eso-phase2.sh"
bash "$APP_DIR/infrastructure/deploy/verify-phase2.sh"

echo "==> Phase 3: Helm deploy"
bash "$APP_DIR/infrastructure/deploy/helm-deploy-phase3.sh"
bash "$APP_DIR/infrastructure/deploy/verify-phase3.sh"

echo ""
echo "Production stack is up. API base:"
bash "$APP_DIR/infrastructure/deploy/verify-k8s-readiness.sh" || true
