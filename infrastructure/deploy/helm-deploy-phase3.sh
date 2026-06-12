#!/usr/bin/env bash
# Phase 3 — Helm deploy CollabSpace stack + migration + rollout (thủ công trên Droplet).
#
#   cd /opt/collabspace
#   sudo bash infrastructure/deploy/helm-deploy-phase3.sh
#
# Dùng IMAGE_TAG từ phase0.env / values-prod.yaml nếu không export IMAGE_TAG.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export APP_DIR="${APP_DIR:-/opt/collabspace}"
PHASE0_ENV="${PHASE0_ENV:-$APP_DIR/infrastructure/deploy/phase0.env}"

if [[ -f "$PHASE0_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PHASE0_ENV"
  set +a
fi

echo "==> Phase 3: Helm deploy CollabSpace"
bash "$SCRIPT_DIR/helm-rollout.sh"

echo ""
echo "Phase 3 deploy finished. Run: sudo bash infrastructure/deploy/verify-phase3.sh"
