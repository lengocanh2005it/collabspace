#!/usr/bin/env bash
# Chạy migration Postgres trên k3s (auth → user → workspace). Postgres only — no RabbitMQ.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/k8s-job-wait.sh
source "$SCRIPT_DIR/lib/k8s-job-wait.sh"
# shellcheck source=lib/scale-app-services.sh
source "$SCRIPT_DIR/lib/scale-app-services.sh"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
PHASE0_ENV="${PHASE0_ENV:-/opt/collabspace/infrastructure/deploy/phase0.env}"
VALUES_PROD="${VALUES_PROD:-/opt/collabspace/infrastructure/helm/collabspace/values-prod.yaml}"

# helm-rollout / CI may export IMAGE_TAG before calling this script; phase0.env must not override it.
ci_image_tag="${IMAGE_TAG:-}"
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
IMAGE_TAG="${IMAGE_TAG:-}"

# Parse per-service image tags (SERVICE_IMAGE_TAGS="svc:tag,svc:tag,...") from CI.
declare -A SVC_TAG_MAP=()
if [[ -n "${SERVICE_IMAGE_TAGS:-}" ]]; then
  local_IFS="$IFS"; IFS=,
  for pair in $SERVICE_IMAGE_TAGS; do
    svc="${pair%%:*}"; tag="${pair#*:}"
    [[ -n "$svc" && -n "$tag" ]] && SVC_TAG_MAP["$svc"]="$tag"
  done
  IFS="$local_IFS"
fi

if [[ -f "$VALUES_PROD" ]]; then
  if grep -q 'ghcr.io/' "$VALUES_PROD"; then
    GHCR_OWNER="${GHCR_OWNER:-$(grep -m1 'repository: ghcr.io/' "$VALUES_PROD" | sed -E 's|.*/ghcr.io/([^/]+)/.*|\1|')}"
    if [[ -z "$IMAGE_TAG" && ${#SVC_TAG_MAP[@]} -eq 0 ]]; then
      IMAGE_TAG="$(grep -m1 'tag:' "$VALUES_PROD" | awk '{print $2}')"
    fi
  fi
fi

IMAGE_TAG="${IMAGE_TAG:-latest}"

if [[ -z "$GHCR_OWNER" ]]; then
  echo "GHCR_OWNER required (phase0.env or values-prod.yaml)."
  exit 1
fi

MIGRATE_PREPARE='rm -rf migrations; for f in dist/migrations/*.js; do case "$(basename "$f")" in [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-*) ;; *) rm -f "$f";; esac; done'

declare -A MIGRATE_CMD=(
  [auth-service]="node dist/src/migrate.js"
  [user-service]="node dist/src/migrate.js"
  [workspace-service]="node dist/src/migrate.js"
)

wait_postgres() {
  echo "==> Waiting for PostgreSQL..."
  kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=postgresql -n "$APP_NS" --timeout=300s
}

apply_migration_job() {
  local deployment="$1"
  local effective_tag="${SVC_TAG_MAP[$deployment]:-$IMAGE_TAG}"
  local image="ghcr.io/${GHCR_OWNER}/collabspace-${deployment}:${effective_tag}"
  local cmd="${MIGRATE_CMD[$deployment]}"
  local job_name="migrate-${deployment}-$(date +%s)"
  local pull_secret_block=""

  if kubectl get secret ghcr-credentials -n "$APP_NS" >/dev/null 2>&1; then
    pull_secret_block="      imagePullSecrets:
        - name: ghcr-credentials"
  fi

  echo "==> Migration Job: $deployment (image=${image})"
  kubectl delete job -n "$APP_NS" -l "collabspace.dev/migration=${deployment}" --ignore-not-found >/dev/null 2>&1 || true

  cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${job_name}
  namespace: ${APP_NS}
  labels:
    collabspace.dev/migration: ${deployment}
spec:
  backoffLimit: 2
  ttlSecondsAfterFinished: 600
  template:
    spec:
      restartPolicy: Never
${pull_secret_block}
      containers:
        - name: migrate
          securityContext:
            runAsUser: 0
            runAsGroup: 0
            runAsNonRoot: false
          image: ${image}
          imagePullPolicy: Always
          command:
            - /bin/sh
            - -c
            - |
              ${MIGRATE_PREPARE}
              exec ${cmd}
          envFrom:
            - configMapRef:
                name: ${deployment}-config
            - secretRef:
                name: ${deployment}-secrets
EOF

  if ! wait_k8s_job "$APP_NS" "$job_name" 300 5; then
    echo "Migration job failed: $deployment"
    exit 1
  fi
  echo "OK  $deployment migration"
}

wait_postgres

if [[ "${SKIP_APP_SCALE_DOWN:-false}" != "true" ]]; then
  ensure_app_services_stopped "$APP_NS"
else
  k8s_job_log "SKIP_APP_SCALE_DOWN=true — apps already stopped by caller"
  terminate_postgres_app_sessions "$APP_NS"
fi

for svc in auth-service user-service workspace-service; do
  apply_migration_job "$svc"
done

echo "All Postgres migrations completed."
