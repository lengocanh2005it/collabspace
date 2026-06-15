#!/usr/bin/env bash
# Copy REDIS_PASSWORD from auth-service secret to user/workspace/task secrets (prod hotfix).
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
REDIS_PW="$(kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d)"

for svc in user-service workspace-service task-service; do
  echo "==> Patching ${svc}-secrets REDIS_PASSWORD"
  kubectl patch secret "${svc}-secrets" -n "$APP_NS" --type merge \
    -p "{\"stringData\":{\"REDIS_PASSWORD\":\"${REDIS_PW}\"}}"
  kubectl rollout restart "deploy/${svc}" -n "$APP_NS"
done

echo "Done. Redis password synced from auth-service."
