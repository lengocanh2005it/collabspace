#!/usr/bin/env bash
# Verify Kafka broker, Debezium Connect, and connector health on K8s.
set -euo pipefail

APP_NS="${APP_NS:-collabspace}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

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
PGPASS="$(kubectl get secret postgres -n "$APP_NS" -o jsonpath='{.data.postgres-password}' | base64 -d)"
kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -tAc 'SHOW wal_level;'

echo "==> Mongo replica set"
MONGO_PASS="$(kubectl get secret mongo -n "$APP_NS" -o jsonpath='{.data.mongodb-root-password}' | base64 -d)"
kubectl exec -n "$APP_NS" deploy/mongo -- mongosh --quiet -u admin -p "$MONGO_PASS" --authenticationDatabase admin --eval 'try { rs.status().ok } catch (e) { 0 }' 2>/dev/null || \
  kubectl exec -n "$APP_NS" statefulset/mongo -- mongosh --quiet -u admin -p "$MONGO_PASS" --authenticationDatabase admin --eval 'try { rs.status().ok } catch (e) { 0 }' 2>/dev/null || echo "mongo rs check skipped"

echo "Kafka + Debezium verify finished."
