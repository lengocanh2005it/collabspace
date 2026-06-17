#!/usr/bin/env bash
# Seed demo data on k3s — database only (Postgres + Mongo). No RabbitMQ.
#
# Order: auth → user → workspace → task (user_replicas + tasks) → notification (user_replicas + notifications).
# Data source: scripts/demo-seed-data.json (host ConfigMap mount when present under APP_DIR).
# RabbitMQ: wiped separately in wipe-prod-data.sh (PVC delete + restart); apps declare queues on startup.
#
# Env: SKIP_APP_SCALE_DOWN, SKIP_RESTORE_REPLICAS, IMAGE_TAG, APP_DIR, APP_NS
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/k8s-job-wait.sh
source "$SCRIPT_DIR/lib/k8s-job-wait.sh"
# shellcheck source=lib/scale-app-services.sh
source "$SCRIPT_DIR/lib/scale-app-services.sh"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_DIR="${APP_DIR:-/opt/collabspace}"
APP_NS="${APP_NS:-collabspace}"
PHASE0_ENV="${PHASE0_ENV:-/opt/collabspace/infrastructure/deploy/phase0.env}"
VALUES_PROD="${VALUES_PROD:-/opt/collabspace/infrastructure/helm/collabspace/values-prod.yaml}"

SEED_SERVICES=(
  auth-service
  user-service
  workspace-service
  task-service
  notification-service
)

SEED_CMD="node dist/seed/seed.js"
USE_HOST_SEED_DATA=false

external_image_tag="${IMAGE_TAG:-}"
if [[ -f "$PHASE0_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PHASE0_ENV"
  set +a
fi
if [[ -n "$external_image_tag" ]]; then
  export IMAGE_TAG="$external_image_tag"
fi

GHCR_OWNER="${GHCR_OWNER:-}"
IMAGE_TAG="${IMAGE_TAG:-}"

if [[ -f "$VALUES_PROD" ]]; then
  if grep -q 'ghcr.io/' "$VALUES_PROD"; then
    GHCR_OWNER="${GHCR_OWNER:-$(grep -m1 'repository: ghcr.io/' "$VALUES_PROD" | sed -E 's|.*/ghcr.io/([^/]+)/.*|\1|')}"
    if [[ -z "$IMAGE_TAG" ]]; then
      IMAGE_TAG="$(grep -m1 'tag:' "$VALUES_PROD" | awk '{print $2}')"
    fi
  fi
fi

IMAGE_TAG="${IMAGE_TAG:-latest}"

sync_demo_seed_configmap() {
  local seed_file="$APP_DIR/scripts/demo-seed-data.json"
  if [[ ! -f "$seed_file" ]]; then
    echo "==> No host demo-seed-data.json at ${seed_file} — using JSON baked into image"
    return 0
  fi
  kubectl create configmap demo-seed-data \
    --from-file=demo-seed-data.json="$seed_file" \
    -n "$APP_NS" --dry-run=client -o yaml | kubectl apply -f -
  USE_HOST_SEED_DATA=true
  echo "==> demo-seed-data ConfigMap synced from ${seed_file}"
}

wait_datastores() {
  echo "==> Waiting for Postgres + Mongo (seed does not use RabbitMQ)..."
  kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=postgresql -n "$APP_NS" --timeout=300s
  kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=mongodb -n "$APP_NS" --timeout=300s
}

resolve_seed_image() {
  local deployment="$1"

  if [[ -z "$external_image_tag" ]]; then
    local deployed_image
    deployed_image="$(kubectl get deployment "$deployment" -n "$APP_NS" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
    if [[ -n "$deployed_image" ]]; then
      printf '%s\n' "$deployed_image"
      return
    fi
  fi

  if [[ -z "$GHCR_OWNER" ]]; then
    echo "GHCR_OWNER required (phase0.env, values-prod.yaml, or existing deployment image)." >&2
    exit 1
  fi

  printf 'ghcr.io/%s/collabspace-%s:%s\n' "$GHCR_OWNER" "$deployment" "$IMAGE_TAG"
}

build_seed_env_block() {
  local block="          env:
            - name: RABBITMQ_ENABLED
              value: \"false\""
  if [[ "$USE_HOST_SEED_DATA" == "true" ]]; then
    block="${block}
            - name: DEMO_SEED_DATA_PATH
              value: /seed/demo-seed-data.json"
  fi
  printf '%s' "$block"
}

apply_seed_job() {
  local deployment="$1"
  local image
  image="$(resolve_seed_image "$deployment")"
  local job_name="seed-${deployment}-$(date +%s)"
  local pull_secret_block=""
  local seed_env_block
  local seed_mount_block=""
  local seed_volumes_block=""

  seed_env_block="$(build_seed_env_block)"

  if [[ "$USE_HOST_SEED_DATA" == "true" ]]; then
    seed_mount_block="          volumeMounts:
            - name: demo-seed-data
              mountPath: /seed/demo-seed-data.json
              subPath: demo-seed-data.json
              readOnly: true"
    seed_volumes_block="      volumes:
        - name: demo-seed-data
          configMap:
            name: demo-seed-data"
  fi

  if kubectl get secret ghcr-credentials -n "$APP_NS" >/dev/null 2>&1; then
    pull_secret_block="      imagePullSecrets:
        - name: ghcr-credentials"
  fi

  echo "==> Seed Job: $deployment (image=${image})"
  kubectl delete job -n "$APP_NS" -l "collabspace.dev/seed=${deployment}" --ignore-not-found >/dev/null 2>&1 || true

  cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${job_name}
  namespace: ${APP_NS}
  labels:
    collabspace.dev/seed: ${deployment}
spec:
  backoffLimit: 2
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: Never
${pull_secret_block}
      containers:
        - name: seed
          image: ${image}
          imagePullPolicy: Always
          command: ["/bin/sh", "-c", "${SEED_CMD}"]
${seed_env_block}
          envFrom:
            - configMapRef:
                name: ${deployment}-config
            - secretRef:
                name: ${deployment}-secrets
${seed_mount_block}
${seed_volumes_block}
EOF

  if ! wait_k8s_job "$APP_NS" "$job_name" 300 5; then
    echo "Seed job failed: $deployment"
    exit 1
  fi
  echo "OK  $deployment seed"
}

scale_seed_writers_to_zero() {
  if [[ "${SKIP_APP_SCALE_DOWN:-false}" == "true" ]]; then
    echo "==> SKIP_APP_SCALE_DOWN=true — apps already stopped by caller"
    terminate_postgres_app_sessions "$APP_NS"
    return 0
  fi
  ensure_app_services_stopped "$APP_NS"
}

restore_seed_replicas() {
  echo "==> Restoring app replica counts after seed..."
  for dep in "${COLLABSPACE_APP_DEPLOYMENTS[@]}"; do
    local replicas
    replicas="$(grep -A20 "^  ${dep}:" "$VALUES_PROD" | grep -m1 'replicas:' | awk '{print $2}' || echo 1)"
    if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
      kubectl scale deployment "$dep" -n "$APP_NS" --replicas="${replicas:-1}"
    fi
  done
}

print_seed_write_targets() {
  if command -v node >/dev/null 2>&1 && [[ -f "$APP_DIR/scripts/load-demo-seed-data.js" ]]; then
    node -e "require(process.argv[1]).printSeedWriteTargets()" "$APP_DIR/scripts/load-demo-seed-data.js"
    return
  fi
  echo "Seed writes (service DB + replicas):"
  echo "  auth-service [postgres]: users, roles, permissions, user_roles, role_permissions"
  echo "  user-service [postgres]: profiles, user_preferences, user_status"
  echo "  workspace-service [postgres]: workspaces, workspace_members, projects, invitations, workspace_activities"
  echo "  task-service [mongodb]: tasks, task_events, task_comments, task_activity; replicas: user_replicas"
  echo "  notification-service [mongodb]: notifications; replicas: user_replicas"
}

echo "==> k8s seed pipeline (each service: own DB + replicas where applicable)"
print_seed_write_targets
wait_datastores
sync_demo_seed_configmap
scale_seed_writers_to_zero

for svc in "${SEED_SERVICES[@]}"; do
  apply_seed_job "$svc"
done

if [[ "${SKIP_RESTORE_REPLICAS:-false}" != "true" ]]; then
  restore_seed_replicas
else
  echo "==> SKIP_RESTORE_REPLICAS=true — caller will restore deployments"
fi

echo ""
echo "All demo seeds completed."
echo "  Postgres: auth users | user profiles | workspaces/projects/members"
echo "  Mongo replicas: user_replicas in task-service + notification-service (all demo users)"
echo "  Mongo data: tasks/comments | notifications"
echo "Demo: ngocanh@collabspace.dev / quangtien@collabspace.dev — password collabspace123"
