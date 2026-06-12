#!/usr/bin/env bash
# Kiểm tra Definition of Done Phase 1 (chạy trên Droplet hoặc máy có kubeconfig).
set -euo pipefail

KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NAMESPACE="${NAMESPACE:-collabspace}"
APP_DIR="${APP_DIR:-/opt/collabspace}"
export KUBECONFIG

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

check "k3s/kubectl available" command -v kubectl
check "helm available" command -v helm
check "node Ready" kubectl wait --for=condition=Ready node --all --timeout=10s
check "namespace ${NAMESPACE} exists" kubectl get namespace "${NAMESPACE}"
check "default StorageClass exists" bash -c '[[ $(kubectl get storageclass --no-headers 2>/dev/null | wc -l) -ge 1 ]]'
check "k3s built-in Traefik absent" bash -c '! kubectl get pods -n kube-system -o name 2>/dev/null | grep -qi traefik'

if [[ -d "$APP_DIR/infrastructure/helm/collabspace/charts" ]]; then
  check "helm charts/ directory present" test -d "$APP_DIR/infrastructure/helm/collabspace/charts"
else
  echo "WARN helm charts/ missing — run: helm dependency update $APP_DIR/infrastructure/helm/collabspace"
fi

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Phase 1 verification FAILED."
  exit 1
fi

echo ""
echo "Phase 1 verification PASSED."
