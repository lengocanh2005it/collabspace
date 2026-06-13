#!/usr/bin/env bash
# Chạy migration Postgres trên k3s (auth → user → workspace).
# Gọi từ helm-deploy-phase3.sh sau khi PostgreSQL Ready.
set -euo pipefail

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

if [[ -f "$VALUES_PROD" ]]; then
  if grep -q 'ghcr.io/' "$VALUES_PROD"; then
    GHCR_OWNER="${GHCR_OWNER:-$(grep -m1 'repository: ghcr.io/' "$VALUES_PROD" | sed -E 's|.*/ghcr.io/([^/]+)/.*|\1|')}"
    if [[ -z "$IMAGE_TAG" ]]; then
      IMAGE_TAG="$(grep -m1 'tag:' "$VALUES_PROD" | awk '{print $2}')"
    fi
  fi
fi

IMAGE_TAG="${IMAGE_TAG:-latest}"

if [[ -z "$GHCR_OWNER" ]]; then
  echo "GHCR_OWNER required (phase0.env or values-prod.yaml)."
  exit 1
fi

declare -A MIGRATE_CMD=(
  [auth-service]="node dist/src/migrate.js"
  [user-service]="node dist/migrate.js"
  [workspace-service]="node dist/migrate.js"
)

wait_postgres() {
  echo "==> Waiting for PostgreSQL..."
  kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=postgresql -n "$APP_NS" --timeout=300s
}

apply_migration_job() {
  local deployment="$1"
  local image="ghcr.io/${GHCR_OWNER}/collabspace-${deployment}:$IMAGE_TAG"
  local cmd="${MIGRATE_CMD[$deployment]}"
  local job_name="migrate-${deployment}-$(date +%s)"
  local pull_secret_block=""
  local migrate_extra_env_block=""

  # values-prod often sets DATABASE_SYNCHRONIZE=false; workspace schema still relies on entity sync.
  if [[ "$deployment" == "workspace-service" ]]; then
    migrate_extra_env_block="          env:
            - name: DATABASE_SYNCHRONIZE
              value: \"true\""
  fi

  if kubectl get secret ghcr-credentials -n "$APP_NS" >/dev/null 2>&1; then
    pull_secret_block="      imagePullSecrets:
        - name: ghcr-credentials"
  fi

  echo "==> Migration Job: $deployment"
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
          image: ${image}
          imagePullPolicy: Always
          command: ["/bin/sh", "-c", "${cmd}"]
          envFrom:
            - configMapRef:
                name: ${deployment}-config
            - secretRef:
                name: ${deployment}-secrets
${migrate_extra_env_block}
EOF

  if ! kubectl wait --for=condition=complete "job/${job_name}" -n "$APP_NS" --timeout=300s; then
    echo "Migration job failed: $deployment"
    kubectl logs -n "$APP_NS" "job/${job_name}" --tail=80 || true
    exit 1
  fi
  echo "OK  $deployment migration"
}

wait_postgres

for svc in auth-service user-service workspace-service; do
  apply_migration_job "$svc"
done

echo "All Postgres migrations completed."
