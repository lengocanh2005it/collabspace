#!/usr/bin/env bash
# Phase 4 — Entrypoint deploy từ GitHub Actions (SSH trên Droplet).
#
# Env bắt buộc: IMAGE_TAG (commit SHA hoặc tag image vừa build)
# Env tùy chọn: GHCR_OWNER, GHCR_USERNAME, GHCR_TOKEN (pull image private)
#
#   export IMAGE_TAG=abc123
#   export GHCR_OWNER=lengocanh2005it
#   bash infrastructure/deploy/helm-deploy-ci.sh
set -euo pipefail

if [[ -z "${IMAGE_TAG:-}" ]]; then
  echo "IMAGE_TAG not set — helm-only deploy, image tags unchanged."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export APP_DIR="${APP_DIR:-/opt/collabspace}"

if [[ -z "${GHCR_OWNER:-}" ]] && [[ -f "$APP_DIR/infrastructure/deploy/phase0.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$APP_DIR/infrastructure/deploy/phase0.env"
  set +a
fi

if [[ -z "${GHCR_OWNER:-}" ]]; then
  echo "GHCR_OWNER required (env or phase0.env)."
  exit 1
fi

GHCR_OWNER="$(printf '%s' "$GHCR_OWNER" | tr '[:upper:]' '[:lower:]')"
export GHCR_OWNER

echo "==> Phase 4 CI deploy (IMAGE_TAG=${IMAGE_TAG:-}, RUN_K8S_MIGRATIONS=${RUN_K8S_MIGRATIONS:-false})"
bash "$SCRIPT_DIR/helm-rollout.sh"
# Post-deploy smoke: verify-k8s-readiness.sh + run-demo-e2e-prod.sh (also invoked from GitHub Actions SSH step).
