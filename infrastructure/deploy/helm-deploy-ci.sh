#!/usr/bin/env bash
# Phase 4 — Entrypoint deploy từ GitHub Actions (SSH trên Droplet).
# CI: build image + Helm rollout only. Migrations/seed: manual on Droplet.
#
# Env (legacy): IMAGE_TAG — cùng tag cho cả 5 app
# Env (per-service): DEPLOY_SERVICES, SERVICE_IMAGE_TAGS
# Env tùy chọn: GHCR_OWNER, GHCR_USERNAME, GHCR_TOKEN
set -euo pipefail

if [[ -z "${IMAGE_TAG:-}" && -z "${SERVICE_IMAGE_TAGS:-}" ]]; then
  echo "IMAGE_TAG / SERVICE_IMAGE_TAGS not set — helm-only deploy, image tags unchanged."
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

echo "==> Phase 4 CI deploy (IMAGE_TAG=${IMAGE_TAG:-}, SERVICE_IMAGE_TAGS=${SERVICE_IMAGE_TAGS:-}, DEPLOY_SERVICES=${DEPLOY_SERVICES:-all}, RUN_K8S_MIGRATIONS=${RUN_K8S_MIGRATIONS:-false})"
bash "$SCRIPT_DIR/helm-rollout.sh"
# Post-deploy smoke: verify-k8s-readiness.sh + run-demo-e2e-prod.sh (also invoked from GitHub Actions SSH step).
