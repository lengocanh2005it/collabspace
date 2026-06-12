#!/usr/bin/env bash
# Kiểm tra Definition of Done Phase 3 (Helm deploy + readiness).
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail=0
check() {
  local desc="$1"
  shift
  if "$@"; then
    echo "OK  $desc"
  else
    echo "FAIL $desc"
    fail=1
  fi
}

check "Helm release collabspace" helm status collabspace -n "$APP_NS"
check "PostgreSQL pod Ready" kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=postgresql -n "$APP_NS" --timeout=30s
check "MongoDB pod Ready" kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=mongodb -n "$APP_NS" --timeout=30s
check "Traefik service exists" kubectl get svc traefik -n "$APP_NS"
check "IngressRoute exists" kubectl get ingressroute collabspace-routes -n "$APP_NS"

for dep in auth-service user-service workspace-service task-service notification-service; do
  check "$dep deployment available" kubectl rollout status deployment/"$dep" -n "$APP_NS" --timeout=30s
done

check "gateway readiness HTTP" bash "$SCRIPT_DIR/verify-k8s-readiness.sh"

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Phase 3 verification FAILED."
  kubectl get pods -n "$APP_NS"
  exit 1
fi

echo ""
echo "Phase 3 verification PASSED."
echo "Optional MVP smoke: BASE_URL=\$(curl -s ...) ./scripts/demo-e2e.sh"
