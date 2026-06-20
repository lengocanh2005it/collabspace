#!/usr/bin/env bash
# Kiểm tra Definition of Done Phase 2 (Vault + ESO).
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
VAULT_NS="${VAULT_NS:-vault}"
ESO_NS="${ESO_NS:-external-secrets}"
APP_NS="${APP_NS:-collabspace}"
VAULT_POD="${VAULT_POD:-vault-0}"
ESO_RELEASE="${ESO_RELEASE:-external-secrets}"

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

check "Vault pod Ready" kubectl wait --for=condition=Ready pod/"$VAULT_POD" -n "$VAULT_NS" --timeout=15s
check "Vault unsealed" bash -c 'kubectl exec -n '"$VAULT_NS"' '"$VAULT_POD"' -- vault status -format=json | jq -e ".sealed == false" >/dev/null'
check "ESO deployment Ready" kubectl rollout status deployment/"$ESO_RELEASE" -n "$ESO_NS" --timeout=15s
check "ClusterSecretStore exists" kubectl get clustersecretstore vault-collabspace
check "auth-service ExternalSecret exists" kubectl get externalsecret auth-service-secrets -n "$APP_NS"
check "auth-service K8s Secret exists" kubectl get secret auth-service-secrets -n "$APP_NS"
check "user-service K8s Secret exists" kubectl get secret user-service-secrets -n "$APP_NS"
check "workspace-service K8s Secret exists" kubectl get secret workspace-service-secrets -n "$APP_NS"
check "task-service K8s Secret exists" kubectl get secret task-service-secrets -n "$APP_NS"
check "notification-service K8s Secret exists" kubectl get secret notification-service-secrets -n "$APP_NS"
check "dlq-service K8s Secret exists" kubectl get secret dlq-service-secrets -n "$APP_NS"

ready_count="$(kubectl get externalsecrets -n "$APP_NS" -o json 2>/dev/null | jq '[.items[] | select(any(.status.conditions[]?; .type=="Ready" and .status=="True"))] | length')"
check "all 6 app ExternalSecrets Ready" test "${ready_count:-0}" -eq 6

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Phase 2 verification FAILED."
  kubectl get externalsecrets -n "$APP_NS" 2>/dev/null || true
  exit 1
fi

echo ""
echo "Phase 2 verification PASSED."
