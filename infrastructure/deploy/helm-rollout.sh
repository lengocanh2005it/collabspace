#!/usr/bin/env bash
# Helm upgrade + optional migration + rollout (dùng chung Phase 3 tay và Phase 4 CI).
# Env: IMAGE_TAG (tùy chọn — nếu set sẽ override tag image qua helm --set)
# Env: RUN_K8S_MIGRATIONS (mặc định false) — chỉ true khi cần chạy Postgres migration Jobs.
# Seed không bao giờ chạy ở đây; dùng run-k8s-seed.sh hoặc run-k8s-full-reset.sh khi cần demo data.
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

# CI/workflow may export IMAGE_TAG before this script; phase0.env must not override it.
ci_image_tag="${IMAGE_TAG:-}"

APP_SERVICES=(auth-service user-service workspace-service task-service notification-service)

if [[ -f "$PHASE0_ENV" ]]; then
  echo "==> Refreshing values-prod.yaml from phase0.env..."
  if [[ -n "$ci_image_tag" ]]; then
    IMAGE_TAG="$ci_image_tag" bash "$SCRIPT_DIR/prepare-prod-values.sh"
  else
    bash "$SCRIPT_DIR/prepare-prod-values.sh"
  fi
fi

cd "$APP_DIR"

if [[ -f "$PHASE0_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PHASE0_ENV"
  set +a
fi
if [[ -n "$ci_image_tag" ]]; then
  export IMAGE_TAG="$ci_image_tag"
else
  unset IMAGE_TAG
fi

GHCR_OWNER="${GHCR_OWNER:-}"

helm_image_tag_sets() {
  if [[ -z "${IMAGE_TAG:-}" ]]; then
    return
  fi
  local svc
  for svc in "${APP_SERVICES[@]}"; do
    printf '%s\n' "--set" "apps.${svc}.image.tag=${IMAGE_TAG}"
  done
}

echo "==> Helm rollout (release=${RELEASE}, namespace=${APP_NS})"
if [[ -n "${IMAGE_TAG:-}" ]]; then
  echo "    Image tag (all app services): ${IMAGE_TAG}"
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
if [[ -n "${ci_image_tag:-}" ]]; then
  echo "==> Persisting image tag ${IMAGE_TAG} for all app services..."
  python3 - <<PYEOF
import re

tag = "${IMAGE_TAG}"
services = ["auth-service", "user-service", "workspace-service", "task-service", "notification-service"]

with open("${VALUES_PROD}", "r") as f:
    content = f.read()

for svc in services:
    pattern = r'(  ' + re.escape(svc) + r':.*?image:\s*\n\s+repository:[^\n]+\n\s+tag:\s*)\S+'
    replacement = r'\g<1>' + tag
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("${VALUES_PROD}", "w") as f:
    f.write(content)

print(f"Updated image tags to {tag} for: {', '.join(services)}")
PYEOF
fi

echo "==> Reconciling RabbitMQ consumer queues (DLX)..."
bash "$SCRIPT_DIR/reconcile-rabbitmq-queues.sh"

restore_app_replicas() {
  if [[ "${REPLICAS_RESTORED:-}" == "1" ]]; then
    return 0
  fi
  REPLICAS_RESTORED=1
  echo "==> Restoring app replica counts from values-prod..."
  for dep in auth-service user-service workspace-service task-service notification-service; do
    replicas="$(grep -A20 "^  ${dep}:" "$VALUES_PROD" | grep -m1 'replicas:' | awk '{print $2}' || echo 1)"
    if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
      kubectl scale deployment "$dep" -n "$APP_NS" --replicas="${replicas:-1}"
    fi
  done
}

# reconcile-rabbitmq may scale consumer deployments to 0 — always restore before rollouts.
restore_app_replicas

if [[ "${RUN_K8S_MIGRATIONS:-false}" == "true" ]]; then
  echo "==> Scaling down Postgres app deployments (migration window)..."
  trap restore_app_replicas EXIT
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
  migration_failed=0
  if ! PHASE0_ENV="$PHASE0_ENV" VALUES_PROD="$VALUES_PROD" APP_NS="$APP_NS" IMAGE_TAG="${IMAGE_TAG:-}" \
    bash "$SCRIPT_DIR/run-k8s-migrations.sh"; then
    migration_failed=1
    echo "ERROR: database migrations failed — restoring replicas before exit."
  fi

  restore_app_replicas

  if [[ "$migration_failed" -eq 1 ]]; then
    exit 1
  fi
else
  echo "==> Skipping Postgres migrations (RUN_K8S_MIGRATIONS=false)."
  echo "    To migrate manually: RUN_K8S_MIGRATIONS=true bash infrastructure/deploy/helm-rollout.sh"
fi

prune_stuck_terminating_pods() {
  local dep="$1"
  local pod
  while IFS= read -r pod; do
    [[ -z "$pod" ]] && continue
    echo "WARN: Force-deleting stuck terminating pod ${pod} (app=${dep})"
    kubectl delete pod "$pod" -n "$APP_NS" --force --grace-period=0 || true
  done < <(kubectl get pods -n "$APP_NS" -l "app=${dep}" --no-headers 2>/dev/null | awk '$3 ~ /Terminating/ {print $1}')
}

# Read one numeric deployment status field (empty / missing → 0).
deploy_status_int() {
  local dep="$1"
  local jsonpath="$2"
  local val
  val="$(kubectl get deployment "$dep" -n "$APP_NS" -o "jsonpath={${jsonpath}}" 2>/dev/null || true)"
  if [[ -z "$val" || ! "$val" =~ ^[0-9]+$ ]]; then
    echo 0
  else
    echo "$val"
  fi
}

rollout_pod_summary() {
  local dep="$1"
  kubectl get pods -n "$APP_NS" -l "app=${dep}" --no-headers 2>/dev/null \
    | awk '{printf "%s(%s/%s) ", $1, $3, $2}' \
    | sed 's/ $//'
}

report_rollout_diagnostics() {
  local dep="$1"
  kubectl get pods -n "$APP_NS" -l "app=${dep}" -o wide 2>/dev/null || true
  local pod
  for pod in $(kubectl get pods -n "$APP_NS" -l "app=${dep}" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
    [[ -z "$pod" ]] && continue
    echo "--- ${pod} (last 25 log lines) ---"
    kubectl logs -n "$APP_NS" "$pod" --tail=25 2>/dev/null || true
    echo "--- ${pod} (events) ---"
    kubectl describe pod -n "$APP_NS" "$pod" 2>/dev/null | awk '/^Events:/,0' || true
  done
  kubectl describe deployment "$dep" -n "$APP_NS" 2>/dev/null | tail -40 || true
}

wait_deployment_rollout() {
  local dep="$1"
  local timeout="${2:-420}"
  local poll=15
  local waited=0
  local last_report=-30
  local diagnostics_at=120

  prune_stuck_terminating_pods "$dep"

  while [[ "$waited" -lt "$timeout" ]]; do
    local desired updated available generation observed pod_summary
    desired="$(deploy_status_int "$dep" '.spec.replicas')"
    updated="$(deploy_status_int "$dep" '.status.updatedReplicas')"
    available="$(deploy_status_int "$dep" '.status.availableReplicas')"
    generation="$(deploy_status_int "$dep" '.metadata.generation')"
    observed="$(deploy_status_int "$dep" '.status.observedGeneration')"

    if [[ "$observed" -ge "$generation" && "$updated" -ge "$desired" && "$available" -ge "$desired" && "$desired" -gt 0 ]]; then
      echo "deployment/${dep} successfully rolled out (${available}/${desired} available)."
      return 0
    fi

    if [[ "$waited" -eq 0 || $((waited - last_report)) -ge 30 ]]; then
      pod_summary="$(rollout_pod_summary "$dep")"
      echo "Waiting for deployment/${dep}: ${available}/${desired} available, ${updated}/${desired} updated, observed/gen ${observed}/${generation} (${waited}s/${timeout}s) pods: ${pod_summary:-none}"
      if [[ "$pod_summary" == *ImagePullBackOff* || "$pod_summary" == *ErrImagePull* ]]; then
        echo "ERROR: ${dep} ImagePullBackOff — tag missing on GHCR or ghcr-credentials invalid."
        report_rollout_diagnostics "$dep"
        return 1
      fi
      last_report="$waited"
    fi

    if [[ "$waited" -ge "$diagnostics_at" && "$diagnostics_at" -gt 0 ]]; then
      echo "WARN: ${dep} rollout slow — dumping diagnostics..."
      report_rollout_diagnostics "$dep"
      diagnostics_at=0
    fi

    sleep "$poll"
    prune_stuck_terminating_pods "$dep"
    waited=$((waited + poll))
  done

  echo "ERROR: deployment/${dep} rollout timed out after ${timeout}s"
  report_rollout_diagnostics "$dep"
  return 1
}

echo "==> Waiting for application rollouts..."
# Roll core services in parallel; notification-service last (RabbitMQ consumer often
# leaves old pods stuck in Terminating on small single-node clusters).
core_deps=(auth-service user-service workspace-service task-service)
rollout_pids=()
for dep in "${core_deps[@]}"; do
  if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
    wait_deployment_rollout "$dep" 420 &
    rollout_pids+=($!)
  fi
done
rollout_failed=0
for pid in "${rollout_pids[@]}"; do
  wait "$pid" || rollout_failed=$((rollout_failed + 1))
done
if [[ "$rollout_failed" -gt 0 ]]; then
  echo "ERROR: $rollout_failed core deployment(s) failed to roll out."
  exit 1
fi

if kubectl get deployment notification-service -n "$APP_NS" >/dev/null 2>&1; then
  if ! wait_deployment_rollout notification-service 600; then
    echo "ERROR: notification-service failed to roll out."
    exit 1
  fi
fi

echo "==> Post-rollout stabilization (S2S clients)..."
sleep "${POST_ROLLOUT_STABILIZATION_SEC:-8}"

if [[ -f "$PHASE0_ENV" ]] && [[ -n "${BREVO_API_KEY:-}" && -n "${BREVO_SENDER_EMAIL:-}" ]]; then
  echo "==> Syncing Brevo sender ConfigMap (helm may reset defaults)..."
  kubectl patch configmap auth-service-config -n "$APP_NS" --type merge \
    -p "{\"data\":{\"BREVO_SENDER_EMAIL\":\"${BREVO_SENDER_EMAIL}\",\"BREVO_SENDER_NAME\":\"${BREVO_SENDER_NAME:-CollabSpace}\",\"EMAIL_DELIVERY_TIMEOUT_MS\":\"15000\"}}" \
    || echo "WARN: Brevo ConfigMap patch failed (non-fatal)."
  kubectl rollout restart deployment/auth-service -n "$APP_NS" 2>/dev/null || true
  kubectl rollout status deployment/auth-service -n "$APP_NS" --timeout=180s 2>/dev/null || true
fi

echo "==> Pruning unused container images..."
crictl rmi --prune 2>/dev/null && echo "Image prune done." || echo "WARN: crictl prune failed (non-fatal)."

echo "Helm rollout finished."
