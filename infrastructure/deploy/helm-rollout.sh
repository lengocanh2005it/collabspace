#!/usr/bin/env bash
# Helm upgrade + migration + rollout (dùng chung Phase 3 tay và Phase 4 CI).
# Env: IMAGE_TAG (tùy chọn — nếu set sẽ override tag image qua helm --set)
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

# CI/workflow may export IMAGE_TAG before this script; phase0.env must not override it.
saved_image_tag="${IMAGE_TAG:-}"
if [[ -f "$PHASE0_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PHASE0_ENV"
  set +a
fi
if [[ -n "$saved_image_tag" ]]; then
  export IMAGE_TAG="$saved_image_tag"
fi

GHCR_OWNER="${GHCR_OWNER:-}"

helm_image_tag_sets() {
  if [[ -z "${IMAGE_TAG:-}" ]]; then
    return
  fi
  local svc
  for svc in auth-service user-service workspace-service task-service notification-service; do
    printf '%s\n' "--set" "apps.${svc}.image.tag=${IMAGE_TAG}"
  done
}

echo "==> Helm rollout (release=${RELEASE}, namespace=${APP_NS})"
if [[ -n "${IMAGE_TAG:-}" ]]; then
  echo "    Image tag override: ${IMAGE_TAG}"
fi

adopt_namespace_for_helm() {
  if kubectl get namespace "$APP_NS" >/dev/null 2>&1; then
    kubectl label namespace "$APP_NS" app.kubernetes.io/managed-by=Helm --overwrite
    kubectl annotate namespace "$APP_NS" \
      meta.helm.sh/release-name="$RELEASE" \
      meta.helm.sh/release-namespace="$APP_NS" \
      --overwrite
  fi
}

ensure_app_external_secrets() {
  if ! grep -A3 'externalSecrets:' "$VALUES_PROD" 2>/dev/null | grep -q 'enabled: true'; then
    return
  fi
  local eso_manifest="$APP_DIR/infrastructure/vault/k8s/external-secrets.prod.yaml"
  local eso_token_file="${VAULT_ESO_TOKEN_FILE:-$APP_DIR/infrastructure/vault/.vault-k3s-eso-token.json}"
  if [[ ! -f "$eso_manifest" ]]; then
    echo "WARN: externalSecrets enabled but missing $eso_manifest"
    return
  fi
  if [[ -f "$eso_token_file" ]] && command -v jq >/dev/null 2>&1; then
    local eso_token
    eso_token="$(jq -r '.auth.client_token' "$eso_token_file")"
    if [[ -n "$eso_token" && "$eso_token" != null ]]; then
      kubectl create secret generic vault-eso-token \
        -n "$APP_NS" \
        --from-literal=token="$eso_token" \
        --dry-run=client -o yaml | kubectl apply -f -
    fi
  fi
  echo "==> Applying ExternalSecrets (Vault sync)..."
  kubectl apply -f "$eso_manifest"
  for es in auth-service user-service workspace-service task-service notification-service; do
    kubectl wait --for=condition=Ready "externalsecret/${es}-secrets" -n "$APP_NS" --timeout=180s
  done
}

echo "==> Ensuring namespace ${APP_NS} exists..."
kubectl create namespace "$APP_NS" --dry-run=client -o yaml | kubectl apply -f -
adopt_namespace_for_helm
ensure_app_external_secrets

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
fi

if [[ "${SKIP_HELM_DEP_UPDATE:-}" == "true" ]]; then
  echo "==> Helm dependency update skipped (pre-uploaded by CI)."
else
  echo "==> Helm dependency update..."
  helm dependency update "$CHART_DIR"
fi

adopt_namespace_for_helm

unlock_stuck_helm_release() {
  if ! helm status "$RELEASE" -n "$APP_NS" >/dev/null 2>&1; then
    return
  fi
  local status rev
  status="$(helm status "$RELEASE" -n "$APP_NS" 2>/dev/null | awk '/^STATUS:/ {print $2}')"
  case "$status" in
    pending-install|pending-upgrade|pending-rollback)
      rev="$(helm status "$RELEASE" -n "$APP_NS" 2>/dev/null | awk '/^REVISION:/ {print $2}')"
      echo "WARN: Release $RELEASE stuck in $status (revision $rev) — clearing pending lock..."
      kubectl delete secret "sh.helm.release.v1.${RELEASE}.v${rev}" -n "$APP_NS" --ignore-not-found
      ;;
  esac
}

unlock_stuck_helm_release

mapfile -t tag_sets < <(helm_image_tag_sets)

echo "==> helm upgrade --install..."
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  -n "$APP_NS" \
  --create-namespace \
  -f "$CHART_DIR/values.yaml" \
  -f "$VALUES_PROD" \
  "${tag_sets[@]}"

# Persist the deployed image tag back into values-prod.yaml so that
# subsequent helm-only deploys (no IMAGE_TAG) don't revert to an old tag.
if [[ -n "${IMAGE_TAG:-}" ]]; then
  echo "==> Persisting image tag ${IMAGE_TAG} into values-prod.yaml..."
  python3 - <<PYEOF
import re, sys

tag = "${IMAGE_TAG}"
services = ["auth-service", "user-service", "workspace-service", "task-service", "notification-service"]

with open("${VALUES_PROD}", "r") as f:
    content = f.read()

for svc in services:
    # Match the service block and replace its image.tag value.
    # Pattern: "  <svc>:\n    ...\n      tag: <anything>"
    pattern = r'(  ' + re.escape(svc) + r':.*?image:\s*\n\s+repository:[^\n]+\n\s+tag:\s*)\S+'
    replacement = r'\g<1>' + tag
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("${VALUES_PROD}", "w") as f:
    f.write(content)

print(f"Updated image tags to {tag}")
PYEOF
fi

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
PHASE0_ENV="$PHASE0_ENV" VALUES_PROD="$VALUES_PROD" APP_NS="$APP_NS" IMAGE_TAG="${IMAGE_TAG:-}" \
  bash "$SCRIPT_DIR/run-k8s-migrations.sh"

echo "==> Restoring app replica counts from values-prod..."
for dep in auth-service user-service workspace-service task-service notification-service; do
  replicas="$(grep -A20 "^  ${dep}:" "$VALUES_PROD" | grep -m1 'replicas:' | awk '{print $2}' || echo 1)"
  if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
    kubectl scale deployment "$dep" -n "$APP_NS" --replicas="${replicas:-1}"
  fi
done

echo "==> Waiting for application rollouts (parallel)..."
rollout_pids=()
for dep in auth-service user-service workspace-service task-service notification-service; do
  if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
    kubectl rollout status deployment/"$dep" -n "$APP_NS" --timeout=300s &
    rollout_pids+=($!)
  fi
done
rollout_failed=0
for pid in "${rollout_pids[@]}"; do
  wait "$pid" || rollout_failed=$((rollout_failed + 1))
done
if [[ "$rollout_failed" -gt 0 ]]; then
  echo "ERROR: $rollout_failed deployment(s) failed to roll out."
  exit 1
fi

echo "==> Pruning unused container images..."
crictl rmi --prune 2>/dev/null && echo "Image prune done." || echo "WARN: crictl prune failed (non-fatal)."

echo "Helm rollout finished."
