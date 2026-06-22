#!/usr/bin/env bash
set -euo pipefail

APP_NS="${APP_NS:-collabspace}"
CNPG_CLUSTER="${POSTGRES_CLUSTER_NAME:-postgres}"

if [[ "${CONFIRM_DELETE_LEGACY_POSTGRES:-}" != "true" ]]; then
  cat >&2 <<'EOF'
Refusing to delete legacy Bitnami PostgreSQL resources.

Set CONFIRM_DELETE_LEGACY_POSTGRES=true after verifying:
- CloudNativePG cluster/postgres is healthy.
- Apps use POSTGRES_HOST=postgres-rw.
- Recent backups are available.

PVC data-postgres-0 is preserved by default. Set DELETE_LEGACY_POSTGRES_PVC=true to delete it too.
EOF
  exit 1
fi

echo "==> Checking CloudNativePG cluster ${CNPG_CLUSTER} in namespace ${APP_NS}"
kubectl wait "cluster/${CNPG_CLUSTER}" -n "${APP_NS}" --for=condition=Ready --timeout=300s

current_primary="$(kubectl get cluster "${CNPG_CLUSTER}" -n "${APP_NS}" -o jsonpath='{.status.currentPrimary}')"
if [[ -z "${current_primary}" ]]; then
  echo "CloudNativePG currentPrimary is empty; aborting" >&2
  exit 1
fi
echo "==> CloudNativePG primary: ${current_primary}"

echo "==> Verifying app Postgres host config"
for cm in auth-service-config user-service-config workspace-service-config; do
  host="$(kubectl get configmap "${cm}" -n "${APP_NS}" -o jsonpath='{.data.POSTGRES_HOST}')"
  if [[ "${host}" != "${CNPG_CLUSTER}-rw" ]]; then
    echo "${cm} POSTGRES_HOST=${host}; expected ${CNPG_CLUSTER}-rw. Aborting." >&2
    exit 1
  fi
done

echo "==> Deleting legacy Bitnami PostgreSQL workload and service resources"
kubectl delete statefulset postgres -n "${APP_NS}" --ignore-not-found
kubectl delete service postgres postgres-hl -n "${APP_NS}" --ignore-not-found
kubectl delete configmap postgres-extended-configuration postgres-init-scripts -n "${APP_NS}" --ignore-not-found
kubectl delete secret postgres -n "${APP_NS}" --ignore-not-found
kubectl delete pdb postgres-primary -n "${APP_NS}" --ignore-not-found

if [[ "${DELETE_LEGACY_POSTGRES_PVC:-}" == "true" ]]; then
  echo "==> Deleting legacy Bitnami PostgreSQL PVC data-postgres-0"
  kubectl delete pvc data-postgres-0 -n "${APP_NS}" --ignore-not-found
else
  echo "==> Preserving PVC data-postgres-0. Delete manually or set DELETE_LEGACY_POSTGRES_PVC=true when safe."
fi

echo "==> Legacy Bitnami PostgreSQL cleanup complete"
