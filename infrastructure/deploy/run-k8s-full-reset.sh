#!/usr/bin/env bash
# Full data reset on k3s: wipe → schema bootstrap → migrate → seed → restore apps.
# Verbose logging; prints job logs immediately on failure.
#
# Usage (on Droplet):
#   export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
#   bash /opt/collabspace/infrastructure/deploy/run-k8s-full-reset.sh
#
# Skip wipe (migrate+seed only):
#   SKIP_WIPE=true bash infrastructure/deploy/run-k8s-full-reset.sh
#
# Env: APP_DIR, APP_NS, IMAGE_TAG (optional — defaults from values-prod.yaml)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/k8s-job-wait.sh
source "$SCRIPT_DIR/lib/k8s-job-wait.sh"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_DIR="${APP_DIR:-/opt/collabspace}"
APP_NS="${APP_NS:-collabspace}"
VALUES_PROD="${VALUES_PROD:-$APP_DIR/infrastructure/helm/collabspace/values-prod.yaml}"
PHASE0_ENV="${PHASE0_ENV:-$APP_DIR/infrastructure/deploy/phase0.env}"
SKIP_WIPE="${SKIP_WIPE:-false}"

if [[ -f "$PHASE0_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PHASE0_ENV"
  set +a
fi

if [[ -z "${IMAGE_TAG:-}" && -f "$VALUES_PROD" ]]; then
  IMAGE_TAG="$(grep -m1 'tag:' "$VALUES_PROD" | awk '{print $2}')"
fi
export IMAGE_TAG="${IMAGE_TAG:-latest}"

k8s_job_log "run-k8s-full-reset (namespace=${APP_NS}, IMAGE_TAG=${IMAGE_TAG}, SKIP_WIPE=${SKIP_WIPE})"

restore_replicas() {
  k8s_job_log "Restoring deployment replicas from values-prod..."
  for dep in auth-service user-service workspace-service task-service notification-service; do
    local replicas
    replicas="$(grep -A20 "^  ${dep}:" "$VALUES_PROD" 2>/dev/null | grep -m1 'replicas:' | awk '{print $2}' || echo 1)"
    if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
      kubectl scale "deployment/${dep}" -n "$APP_NS" --replicas="${replicas:-1}"
      k8s_job_log "  scaled ${dep} → ${replicas:-1}"
    fi
  done
}

trap restore_replicas EXIT

scale_writers_to_zero() {
  k8s_job_log "Scaling app deployments to 0 (stop writers)..."
  for dep in auth-service user-service workspace-service task-service notification-service; do
    kubectl scale "deployment/${dep}" -n "$APP_NS" --replicas=0 2>/dev/null || true
  done
  sleep 5
}

bootstrap_auth_schema_sql() {
  local sql_file="$APP_DIR/services/auth-service/scripts/sql/001_init_auth_schema.sql"
  if [[ ! -f "$sql_file" ]]; then
    k8s_job_log "WARN: auth SQL baseline missing — expect CreateAuthFoundation migration in image"
    return 0
  fi
  k8s_job_log "Bootstrap auth schema from SQL (fallback until foundation migration is in deployed image)..."
  cat "$sql_file" | psql_exec -d collabspace_auth
  k8s_job_log "OK  auth SQL baseline applied"
}

bootstrap_workspace_schema_sync() {
  k8s_job_log "Bootstrap workspace schema (DATABASE_SYNCHRONIZE=true one-off)..."
  kubectl patch configmap workspace-service-config -n "$APP_NS" --type merge \
    -p '{"data":{"DATABASE_SYNCHRONIZE":"true"}}'
  kubectl scale deployment workspace-service -n "$APP_NS" --replicas=1
  kubectl wait --for=condition=available deployment/workspace-service -n "$APP_NS" --timeout=180s
  sleep 8
  if ! psql_exec -d collabspace_workspace -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='workspaces' LIMIT 1" \
    | grep -q 1; then
    k8s_job_log "ERROR: workspaces table missing after synchronize bootstrap"
    kubectl logs -n "$APP_NS" -l app=workspace-service --tail=80 || true
    return 1
  fi
  kubectl patch configmap workspace-service-config -n "$APP_NS" --type merge \
    -p '{"data":{"DATABASE_SYNCHRONIZE":"false"}}'
  kubectl rollout restart deployment/workspace-service -n "$APP_NS"
  kubectl scale deployment workspace-service -n "$APP_NS" --replicas=0
  kubectl wait --for=delete pod -l app=workspace-service -n "$APP_NS" --timeout=120s 2>/dev/null || true
  k8s_job_log "OK  workspace schema bootstrap"
}

PGPASS=""

psql_exec() {
  kubectl exec -i -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

if [[ "$SKIP_WIPE" != "true" ]]; then
  k8s_job_log "Step 1/5: wipe application data"
  bash "$SCRIPT_DIR/wipe-prod-data.sh"
  # wipe-prod-data scales apps back up — scale down again for migrate window
  scale_writers_to_zero
else
  k8s_job_log "Step 1/5: SKIP_WIPE=true — keeping existing databases"
  scale_writers_to_zero
fi

PGPASS="$(kubectl get secret postgres -n "$APP_NS" -o jsonpath='{.data.postgres-password}' | base64 -d)"

k8s_job_log "Step 2/5: bootstrap empty Postgres schemas"
bootstrap_auth_schema_sql
bootstrap_workspace_schema_sync

k8s_job_log "Step 3/5: run TypeORM migrations (auth → user → workspace)"
if ! APP_DIR="$APP_DIR" APP_NS="$APP_NS" IMAGE_TAG="$IMAGE_TAG" VALUES_PROD="$VALUES_PROD" PHASE0_ENV="$PHASE0_ENV" \
  bash "$SCRIPT_DIR/run-k8s-migrations.sh"; then
  k8s_job_log "ERROR: migrations failed — see job logs above"
  exit 1
fi

k8s_job_log "Step 4/5: seed demo data"
if ! APP_DIR="$APP_DIR" APP_NS="$APP_NS" IMAGE_TAG="$IMAGE_TAG" VALUES_PROD="$VALUES_PROD" PHASE0_ENV="$PHASE0_ENV" \
  bash "$SCRIPT_DIR/run-k8s-seed.sh"; then
  k8s_job_log "ERROR: seed failed — see job logs above"
  exit 1
fi

k8s_job_log "Step 5/5: restore app deployments"
restore_replicas
trap - EXIT

k8s_job_log "Waiting for core pods..."
sleep 20
kubectl get pods -n "$APP_NS" | grep -E 'NAME|auth|user|workspace|task|notification' || true

k8s_job_log "Health check (Traefik)"
for path in auth users workspaces tasks notifications; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1/api/v1/${path}/health/live" || echo 000)"
  k8s_job_log "  /api/v1/${path}/health/live → ${code}"
done

k8s_job_log "Full reset completed."
k8s_job_log "Demo: ngocanh@collabspace.dev / quangtien@collabspace.dev — password collabspace123"
