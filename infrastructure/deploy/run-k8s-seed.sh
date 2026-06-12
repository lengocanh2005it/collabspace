#!/usr/bin/env bash
# Seed demo data on k3s (auth → user → workspace → task → notification).
# Requires images built with seed:prod and scripts/demo-seed-data.json in the image.
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
PHASE0_ENV="${PHASE0_ENV:-/opt/collabspace/infrastructure/deploy/phase0.env}"
VALUES_PROD="${VALUES_PROD:-/opt/collabspace/infrastructure/helm/collabspace/values-prod.yaml}"

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

SEED_CMD="node dist/seed/seed.js"

wait_datastores() {
  echo "==> Waiting for datastores..."
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

apply_seed_job() {
  local deployment="$1"
  local image
  image="$(resolve_seed_image "$deployment")"
  local cmd="${SEED_CMD}"
  local job_name="seed-${deployment}-$(date +%s)"
  local pull_secret_block=""

  if kubectl get secret ghcr-credentials -n "$APP_NS" >/dev/null 2>&1; then
    pull_secret_block="      imagePullSecrets:
        - name: ghcr-credentials"
  fi

  echo "==> Seed Job: $deployment"
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
          command: ["/bin/sh", "-c", "${cmd}"]
          envFrom:
            - configMapRef:
                name: ${deployment}-config
            - secretRef:
                name: ${deployment}-secrets
EOF

  if ! kubectl wait --for=condition=complete "job/${job_name}" -n "$APP_NS" --timeout=300s; then
    echo "Seed job failed: $deployment"
    kubectl logs -n "$APP_NS" "job/${job_name}" --tail=80 || true
    exit 1
  fi
  echo "OK  $deployment seed"
}

wait_datastores

for svc in auth-service user-service workspace-service task-service notification-service; do
  apply_seed_job "$svc"
done

echo "All demo seeds completed."
echo "Demo users: ngocanh@collabspace.dev / quangtien@collabspace.dev — password collabspace123"
