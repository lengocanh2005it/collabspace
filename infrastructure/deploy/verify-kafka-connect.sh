#!/usr/bin/env bash
# Verify Kafka broker, Debezium Connect, and connector health on K8s.
set -euo pipefail

APP_NS="${APP_NS:-collabspace}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/postgres-target.sh
source "$SCRIPT_DIR/lib/postgres-target.sh"

echo "==> Kafka pod"
kubectl get pods -n "$APP_NS" -l app=kafka -o wide

echo "==> Debezium Connect pod"
kubectl get pods -n "$APP_NS" -l app=debezium-connect -o wide

echo "==> Wait Kafka ready"
kubectl wait --for=condition=ready pod -l app=kafka -n "$APP_NS" --timeout=300s

echo "==> Wait Debezium Connect ready"
kubectl wait --for=condition=available deployment/debezium-connect -n "$APP_NS" --timeout=300s

echo "==> Connectors"
kubectl exec -n "$APP_NS" deploy/debezium-connect -- curl -sf http://localhost:8083/connectors
echo

for name in collabspace-workspace-outbox collabspace-user-outbox collabspace-task-outbox; do
  echo "--- $name ---"
  kubectl exec -n "$APP_NS" deploy/debezium-connect -- curl -sf "http://localhost:8083/connectors/$name/status" || echo "MISSING"
  echo
done

echo "==> Postgres wal_level"
postgres_psql "$APP_NS" -tAc 'SHOW wal_level;'

echo "==> Mongo replica set"
MONGO_PASS="$(kubectl get secret mongo -n "$APP_NS" -o jsonpath='{.data.mongodb-root-password}' | base64 -d)"
kubectl exec -n "$APP_NS" deploy/mongo -- mongosh --quiet -u admin -p "$MONGO_PASS" --authenticationDatabase admin --eval 'try { rs.status().ok } catch (e) { 0 }' 2>/dev/null || \
  kubectl exec -n "$APP_NS" statefulset/mongo -- mongosh --quiet -u admin -p "$MONGO_PASS" --authenticationDatabase admin --eval 'try { rs.status().ok } catch (e) { 0 }' 2>/dev/null || echo "mongo rs check skipped"

echo "Kafka + Debezium verify finished."
