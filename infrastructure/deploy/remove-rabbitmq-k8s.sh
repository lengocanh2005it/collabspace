#!/usr/bin/env bash
# Remove legacy RabbitMQ StatefulSet after Kafka cutover (Phase 6).
set -euo pipefail

APP_NS="${APP_NS:-collabspace}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

echo "==> Removing RabbitMQ from namespace ${APP_NS}..."
kubectl delete statefulset rabbitmq -n "$APP_NS" --ignore-not-found --wait=true
kubectl delete svc rabbitmq rabbitmq-headless -n "$APP_NS" --ignore-not-found
kubectl delete pvc -n "$APP_NS" -l app.kubernetes.io/name=rabbitmq --ignore-not-found
echo "RabbitMQ removed."
