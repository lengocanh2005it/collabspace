#!/usr/bin/env bash
# Wipe application data on k3s (PostgreSQL + MongoDB + Redis). DESTRUCTIVE.
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NS="${APP_NS:-collabspace}"

echo "==> Scaling app deployments to 0 (stop writers)..."
for dep in auth-service user-service workspace-service task-service notification-service; do
  kubectl scale deployment "$dep" -n "$NS" --replicas=0 2>/dev/null || true
done
sleep 5

PGPASS=$(kubectl get secret postgres -n "$NS" -o jsonpath='{.data.postgres-password}' | base64 -d)

psql_exec() {
  kubectl exec -n "$NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

echo "==> Wiping PostgreSQL databases..."
for db in collabspace_auth collabspace_user collabspace_workspace; do
  echo "  - $db"
  psql_exec -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  psql_exec -c "DROP DATABASE IF EXISTS \"${db}\";"
  psql_exec -c "CREATE DATABASE \"${db}\";"
done

echo "==> Wiping MongoDB databases..."
MONGO_POD=$(kubectl get pod -n "$NS" -l app.kubernetes.io/name=mongodb -o jsonpath='{.items[0].metadata.name}')
MONGO_PASS=$(kubectl get secret mongo -n "$NS" -o jsonpath='{.data.mongodb-root-password}' | base64 -d)
MONGOSH="/opt/bitnami/mongodb/bin/mongosh"
for db in collabspace_task collabspace_notification; do
  echo "  - $db"
  kubectl exec -n "$NS" "$MONGO_POD" -c mongodb -- \
    "$MONGOSH" -u admin -p "$MONGO_PASS" --authenticationDatabase admin --quiet \
    --eval "db.getSiblingDB('${db}').dropDatabase()"
done

echo "==> Flushing Redis..."
if kubectl get pod -n "$NS" redis-master-0 >/dev/null 2>&1; then
  REDIS_PASS=$(kubectl get secret -n "$NS" redis -o jsonpath='{.data.redis-password}' 2>/dev/null | base64 -d 2>/dev/null || true)
  if [ -n "$REDIS_PASS" ]; then
    kubectl exec -n "$NS" redis-master-0 -- redis-cli -a "$REDIS_PASS" FLUSHALL >/dev/null
  else
    kubectl exec -n "$NS" redis-master-0 -- redis-cli FLUSHALL >/dev/null
  fi
  echo "  Redis flushed."
else
  echo "  Redis pod not found — skipped."
fi

echo "==> Scaling app deployments back..."
kubectl scale deployment auth-service user-service workspace-service -n "$NS" --replicas=2
kubectl scale deployment task-service notification-service -n "$NS" --replicas=1

echo ""
echo "All application data wiped:"
echo "  PostgreSQL: collabspace_auth, collabspace_user, collabspace_workspace"
echo "  MongoDB:    collabspace_task, collabspace_notification"
echo "  Redis:      FLUSHALL"
echo ""
echo "Next: run migrations (helm-rollout) then seed (run-k8s-seed.sh)."
