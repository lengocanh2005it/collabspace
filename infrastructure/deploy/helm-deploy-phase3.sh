#!/usr/bin/env bash
# Phase 3 — Helm deploy CollabSpace stack + migration + rollout.
# Chạy trên Droplet sau Phase 2 (Vault + ESO).
#
#   cd /opt/collabspace
#   sudo bash infrastructure/deploy/helm-deploy-phase3.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/collabspace}"
APP_NS="${APP_NS:-collabspace}"
RELEASE="${RELEASE:-collabspace}"
CHART_DIR="${CHART_DIR:-$APP_DIR/infrastructure/helm/collabspace}"
VALUES_PROD="${VALUES_PROD:-$CHART_DIR/values-prod.yaml}"
PHASE0_ENV="${PHASE0_ENV:-$APP_DIR/infrastructure/deploy/phase0.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

if ! command -v helm >/dev/null 2>&1 || ! command -v kubectl >/dev/null 2>&1; then
  echo "helm and kubectl required (run Phase 1 first)."
  exit 1
fi

if [[ ! -f "$VALUES_PROD" ]]; then
  echo "Missing $VALUES_PROD — run prepare-prod-values.sh (Phase 0)."
  exit 1
fi

cd "$APP_DIR"

if [[ -f "$PHASE0_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PHASE0_ENV"
  set +a
fi

echo "==> Phase 3: Helm deploy CollabSpace"

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "==> Creating/updating ghcr-credentials..."
  kubectl create secret docker-registry ghcr-credentials \
    -n "$APP_NS" \
    --docker-server=ghcr.io \
    --docker-username="${GHCR_USERNAME:-${GHCR_OWNER:-}}" \
    --docker-password="$GHCR_TOKEN" \
    --dry-run=client -o yaml | kubectl apply -f -
elif kubectl get secret ghcr-credentials -n "$APP_NS" >/dev/null 2>&1; then
  echo "Using existing ghcr-credentials secret."
else
  echo "WARN: No GHCR_TOKEN and no ghcr-credentials — image pull may fail if GHCR packages are private."
  echo "      Set GHCR_TOKEN in phase0.env or make packages public / remove imagePullSecrets from values-prod.yaml."
fi

echo "==> Helm dependency update..."
helm dependency update "$CHART_DIR"

echo "==> helm upgrade --install..."
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  -n "$APP_NS" \
  --create-namespace \
  -f "$CHART_DIR/values.yaml" \
  -f "$VALUES_PROD" \
  --wait --timeout 20m

echo "==> Scaling down Postgres app deployments (migration window)..."
for dep in auth-service user-service workspace-service; do
  if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
    kubectl scale deployment "$dep" -n "$APP_NS" --replicas=0
  fi
done

echo "==> Waiting for data stores..."
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=postgresql -n "$APP_NS" --timeout=300s || true
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=mongodb -n "$APP_NS" --timeout=300s || true
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=redis -n "$APP_NS" --timeout=300s || true
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=rabbitmq -n "$APP_NS" --timeout=300s || true

echo "==> Running database migrations..."
PHASE0_ENV="$PHASE0_ENV" VALUES_PROD="$VALUES_PROD" APP_NS="$APP_NS" \
  bash "$SCRIPT_DIR/run-k8s-migrations.sh"

echo "==> Restoring app replica counts from values-prod..."
for dep in auth-service user-service workspace-service task-service notification-service; do
  replicas="$(grep -A20 "^  ${dep}:" "$VALUES_PROD" | grep -m1 'replicas:' | awk '{print $2}' || echo 1)"
  if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
    kubectl scale deployment "$dep" -n "$APP_NS" --replicas="${replicas:-1}"
  fi
done

echo "==> Waiting for application rollouts..."
for dep in auth-service user-service workspace-service task-service notification-service; do
  if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
    kubectl rollout status deployment/"$dep" -n "$APP_NS" --timeout=300s
  fi
done

echo ""
echo "Phase 3 deploy finished. Run: sudo bash infrastructure/deploy/verify-phase3.sh"
