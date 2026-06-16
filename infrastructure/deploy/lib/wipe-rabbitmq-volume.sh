#!/usr/bin/env bash
# Scale down RabbitMQ StatefulSet, delete PVCs, restart with empty data volume.
# Apps declare queues/DLX on startup — seed and migrate do not use RabbitMQ.
set -euo pipefail

wipe_rabbitmq_volume() {
  local ns="${1:-${APP_NS:-collabspace}}"
  local sts="${RABBITMQ_STS:-rabbitmq}"

  if ! kubectl get statefulset "$sts" -n "$ns" >/dev/null 2>&1; then
    k8s_job_log "RabbitMQ StatefulSet ${sts} not found — skipped."
    return 0
  fi

  k8s_job_log "Wiping RabbitMQ: scale ${sts} to 0, delete PVCs, restart..."
  kubectl scale "statefulset/${sts}" -n "$ns" --replicas=0
  kubectl wait --for=delete pod -l app.kubernetes.io/name=rabbitmq -n "$ns" --timeout=180s 2>/dev/null || true

  local pvc_count=0
  while IFS= read -r pvc; do
    [[ -z "$pvc" ]] && continue
    k8s_job_log "  deleting ${pvc}"
    kubectl delete "$pvc" -n "$ns" --timeout=120s 2>/dev/null || true
    pvc_count=$((pvc_count + 1))
  done < <(kubectl get pvc -n "$ns" -o name 2>/dev/null | grep -i rabbitmq || true)

  if [[ "$pvc_count" -eq 0 ]]; then
    k8s_job_log "  no RabbitMQ PVC found (fresh install or already deleted)"
  fi

  kubectl scale "statefulset/${sts}" -n "$ns" --replicas=1
  kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=rabbitmq -n "$ns" --timeout=300s
  k8s_job_log "OK  RabbitMQ running with empty volume (vhost collabspace from Helm)"
}
