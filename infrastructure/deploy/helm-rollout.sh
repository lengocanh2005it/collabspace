#!/usr/bin/env bash
# Helm upgrade + optional migration + rollout (dùng chung Phase 3 tay và Phase 4 CI).
# Env: IMAGE_TAG (legacy — cùng tag cho toàn bộ app services khi set một mình)
# Env: DEPLOY_SERVICES — danh sách service cần rollout (vd. auth-service,task-service)
# Env: SERVICE_IMAGE_TAGS — tag riêng từng service (vd. auth-service:auth-service-abc1234,task-service:task-service-abc1234)
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
# shellcheck source=lib/postgres-target.sh
source "$SCRIPT_DIR/lib/postgres-target.sh"

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

APP_SERVICES=(auth-service user-service workspace-service task-service notification-service dlq-service analytics-service)
declare -A SERVICE_IMAGE_TAG_MAP=()
DEPLOY_SERVICE_LIST=()

load_service_image_tags() {
  SERVICE_IMAGE_TAG_MAP=()
  [[ -z "${SERVICE_IMAGE_TAGS:-}" ]] && return
  local pair svc tag
  local IFS=,
  for pair in $SERVICE_IMAGE_TAGS; do
    svc="${pair%%:*}"
    tag="${pair#*:}"
    [[ -z "$svc" || -z "$tag" ]] && continue
    SERVICE_IMAGE_TAG_MAP["$svc"]="$tag"
  done
}

resolve_deploy_service_list() {
  DEPLOY_SERVICE_LIST=()
  if [[ -n "${DEPLOY_SERVICES:-}" ]]; then
    local IFS=,
    read -ra DEPLOY_SERVICE_LIST <<< "$DEPLOY_SERVICES"
    return
  fi
  if [[ ${#SERVICE_IMAGE_TAG_MAP[@]} -gt 0 ]]; then
    DEPLOY_SERVICE_LIST=("${!SERVICE_IMAGE_TAG_MAP[@]}")
    return
  fi
  DEPLOY_SERVICE_LIST=("${APP_SERVICES[@]}")
}

load_service_image_tags
resolve_deploy_service_list

if [[ ${#SERVICE_IMAGE_TAG_MAP[@]} -gt 0 ]]; then
  ci_image_tag=""
  unset IMAGE_TAG
fi

if [[ -f "$PHASE0_ENV" ]]; then
  if [[ ${#SERVICE_IMAGE_TAG_MAP[@]} -gt 0 ]]; then
    echo "==> Per-service image tags — skipping prepare-prod-values (helm --set per app)."
  elif [[ -n "$ci_image_tag" ]]; then
    echo "==> Refreshing values-prod.yaml with IMAGE_TAG=${ci_image_tag}..."
    IMAGE_TAG="$ci_image_tag" bash "$SCRIPT_DIR/prepare-prod-values.sh"
  else
    echo "==> Helm-only deploy — keeping image tags in values-prod.yaml (no prepare-prod-values)."
  fi
fi

cd "$APP_DIR"

if [[ -f "$PHASE0_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PHASE0_ENV"
  set +a
fi
if [[ ${#SERVICE_IMAGE_TAG_MAP[@]} -gt 0 ]]; then
  unset IMAGE_TAG
elif [[ -n "$ci_image_tag" ]]; then
  export IMAGE_TAG="$ci_image_tag"
else
  unset IMAGE_TAG
fi

GHCR_OWNER="${GHCR_OWNER:-}"

helm_image_tag_sets() {
  local svc tag
  if [[ ${#SERVICE_IMAGE_TAG_MAP[@]} -gt 0 ]]; then
    for svc in "${!SERVICE_IMAGE_TAG_MAP[@]}"; do
      tag="${SERVICE_IMAGE_TAG_MAP[$svc]}"
      printf '%s\n' "--set" "apps.${svc}.image.tag=${tag}"
    done
    return
  fi
  if [[ -z "${IMAGE_TAG:-}" ]]; then
    return
  fi
  for svc in "${APP_SERVICES[@]}"; do
    printf '%s\n' "--set" "apps.${svc}.image.tag=${IMAGE_TAG}"
  done
}

echo "==> Helm rollout (release=${RELEASE}, namespace=${APP_NS})"
if [[ ${#SERVICE_IMAGE_TAG_MAP[@]} -gt 0 ]]; then
  echo "    Per-service image tags: ${SERVICE_IMAGE_TAGS}"
elif [[ -n "${IMAGE_TAG:-}" ]]; then
  echo "    Image tag (all app services): ${IMAGE_TAG}"
fi
if [[ -n "${DEPLOY_SERVICES:-}" ]]; then
  echo "    Rollout scope: ${DEPLOY_SERVICES}"
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

cloudnativepg_enabled_in_values() {
  awk '
    /^cloudnativepg:[[:space:]]*$/ { in_block=1; next }
    in_block && /^[^[:space:]]/ { in_block=0 }
    in_block && /^[[:space:]]+enabled:[[:space:]]*true([[:space:]]*(#.*)?)?$/ { found=1; print "true"; exit }
    END { if (!found) print "false" }
  ' "$VALUES_PROD"
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
  for extra in \
    "$APP_DIR/infrastructure/vault/k8s/external-secret-backup.yaml" \
    "$APP_DIR/infrastructure/vault/k8s/external-secret-alertmanager.yaml"; do
    if [[ -f "$extra" ]]; then
      kubectl apply -f "$extra"
    fi
  done
  for es in auth-service user-service workspace-service task-service notification-service dlq-service analytics-service; do
    kubectl wait --for=condition=Ready "externalsecret/${es}-secrets" -n "$APP_NS" --timeout=180s
  done
  for es in backup-spaces-secret alertmanager-slack-secret; do
    if kubectl get externalsecret "$es" -n "$APP_NS" >/dev/null 2>&1; then
      kubectl wait --for=condition=Ready "externalsecret/${es}" -n "$APP_NS" --timeout=180s || true
    fi
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

if [[ "$(cloudnativepg_enabled_in_values)" == "true" ]]; then
  echo "==> Ensuring CloudNativePG operator..."
  helm repo add cnpg https://cloudnative-pg.github.io/charts >/dev/null 2>&1 || true
  helm repo update cnpg
  helm upgrade --install cnpg cnpg/cloudnative-pg \
    --namespace cnpg-system \
    --create-namespace \
    --version 0.22.0 \
    --wait \
    --timeout 10m
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

echo "==> Ensuring MongoDB secret has replica-set key (one-time migration from standalone)..."
if kubectl get secret mongo -n "$APP_NS" >/dev/null 2>&1; then
  if ! kubectl get secret mongo -n "$APP_NS" -o jsonpath='{.data.mongodb-replica-set-key}' | grep -q .; then
    echo "    Secret 'mongo' missing mongodb-replica-set-key — deleting so Helm recreates it."
    kubectl delete secret mongo -n "$APP_NS"
  fi
fi

echo "==> helm upgrade --install..."
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  -n "$APP_NS" \
  --create-namespace \
  -f "$CHART_DIR/values.yaml" \
  -f "$VALUES_PROD" \
  "${tag_sets[@]}"

echo "==> Waiting for Kafka + Debezium Connect (if deployed)..."
if kubectl get statefulset kafka -n "$APP_NS" >/dev/null 2>&1; then
  kubectl wait --for=condition=ready pod -l app=kafka -n "$APP_NS" --timeout=420s
fi
if kubectl get deployment debezium-connect -n "$APP_NS" >/dev/null 2>&1; then
  kubectl wait --for=condition=available deployment/debezium-connect -n "$APP_NS" --timeout=420s
fi

# Persist deployed image tag(s) back into values-prod.yaml.
if [[ ${#SERVICE_IMAGE_TAG_MAP[@]} -gt 0 ]]; then
  echo "==> Persisting per-service image tags to values-prod.yaml..."
  python3 - <<PYEOF
import re

tag_map = {
$(for svc in "${!SERVICE_IMAGE_TAG_MAP[@]}"; do
  printf '    "%s": "%s",\n' "$svc" "${SERVICE_IMAGE_TAG_MAP[$svc]}"
done)
}

with open("${VALUES_PROD}", "r") as f:
    content = f.read()

for svc, tag in tag_map.items():
    pattern = r'(  ' + re.escape(svc) + r':.*?image:\s*\n\s+repository:[^\n]+\n\s+tag:\s*)\S+'
    replacement = r'\g<1>' + tag
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("${VALUES_PROD}", "w") as f:
    f.write(content)

print("Updated image tags:", ", ".join(f"{k}={v}" for k, v in tag_map.items()))
PYEOF
elif [[ -n "${ci_image_tag:-}" ]]; then
  echo "==> Persisting image tag ${IMAGE_TAG} for all app services..."
  python3 - <<PYEOF
import re

tag = "${IMAGE_TAG}"
services = ["auth-service", "user-service", "workspace-service", "task-service", "notification-service", "dlq-service", "analytics-service"]

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

restore_app_replicas() {
  echo "==> Restoring app replica counts from values-prod..."
  for dep in auth-service user-service workspace-service task-service notification-service dlq-service analytics-service; do
    replicas="$(grep -A20 "^  ${dep}:" "$VALUES_PROD" | grep -m1 'replicas:' | awk '{print $2}' || echo 1)"
    if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
      kubectl scale deployment "$dep" -n "$APP_NS" --replicas="${replicas:-1}"
    fi
  done
}

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
  wait_postgres_ready "$APP_NS" 300s || true
  kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=mongodb -n "$APP_NS" --timeout=300s || true
  kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=redis -n "$APP_NS" --timeout=300s || true

  echo "==> Running database migrations..."
  migration_failed=0
  if ! PHASE0_ENV="$PHASE0_ENV" VALUES_PROD="$VALUES_PROD" APP_NS="$APP_NS" IMAGE_TAG="${IMAGE_TAG:-}" SERVICE_IMAGE_TAGS="${SERVICE_IMAGE_TAGS:-}" \
    bash "$SCRIPT_DIR/run-k8s-migrations.sh"; then
    migration_failed=1
    echo "ERROR: database migrations failed — restoring replicas before exit."
  fi

  restore_app_replicas
  trap - EXIT

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
rollout_targets=()
for dep in "${DEPLOY_SERVICE_LIST[@]}"; do
  if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
    rollout_targets+=("$dep")
  fi
done

if [[ ${#rollout_targets[@]} -eq 0 ]]; then
  echo "No application deployments in rollout scope — skipping wait."
else
  core_deps=()
  notif_in_scope=false
  for dep in "${rollout_targets[@]}"; do
    if [[ "$dep" == "notification-service" ]]; then
      notif_in_scope=true
    else
      core_deps+=("$dep")
    fi
  done

  rollout_pids=()
  for dep in "${core_deps[@]}"; do
    wait_deployment_rollout "$dep" 420 &
    rollout_pids+=($!)
  done
  rollout_failed=0
  for pid in "${rollout_pids[@]}"; do
    wait "$pid" || rollout_failed=$((rollout_failed + 1))
  done
  if [[ "$rollout_failed" -gt 0 ]]; then
    echo "ERROR: $rollout_failed deployment(s) failed to roll out."
    exit 1
  fi

  if [[ "$notif_in_scope" == "true" ]]; then
    if ! wait_deployment_rollout notification-service 600; then
      echo "ERROR: notification-service failed to roll out."
      exit 1
    fi
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
