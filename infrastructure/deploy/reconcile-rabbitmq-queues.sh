#!/usr/bin/env bash
# Reconcile RabbitMQ consumer queues before app rollouts.
# Deletes legacy queues missing DLX args so services can re-declare with collabspace_dlx.
set -euo pipefail

APP_NS="${APP_NS:-collabspace}"
RABBITMQ_POD="${RABBITMQ_POD:-rabbitmq-0}"
RABBITMQ_VHOST="${RABBITMQ_VHOST:-collabspace}"
DLX_EXCHANGE="${RABBITMQ_DLX_EXCHANGE:-collabspace_dlx}"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

# queue_name:deployment_name
CONSUMER_QUEUES=(
  "auth-service:auth-service"
  "user-service:user-service"
  "task-service:task-service"
  "notification-service:notification-service"
)

queue_arguments() {
  local queue="$1"
  kubectl exec -n "$APP_NS" "$RABBITMQ_POD" -- \
    rabbitmqctl list_queues -p "$RABBITMQ_VHOST" name arguments --formatter json 2>/dev/null \
    | python3 -c "
import json, sys
target = sys.argv[1]
for row in json.load(sys.stdin):
    if row.get('name') == target:
        print(json.dumps(row.get('arguments') or {}))
        break
" "$queue" 2>/dev/null || echo "{}"
}

queue_has_expected_dlx() {
  local queue="$1"
  local expected_rk="${queue}.dlq"
  local args
  args="$(queue_arguments "$queue")"
  python3 -c "
import json, sys
args = json.loads(sys.argv[1])
expected_dlx = sys.argv[2]
expected_rk = sys.argv[3]
dlx = args.get('x-dead-letter-exchange')
rk = args.get('x-dead-letter-routing-key')
sys.exit(0 if dlx == expected_dlx and rk == expected_rk else 1)
" "$args" "$DLX_EXCHANGE" "$expected_rk"
}

queue_exists() {
  local queue="$1"
  kubectl exec -n "$APP_NS" "$RABBITMQ_POD" -- \
    rabbitmqctl list_queues -p "$RABBITMQ_VHOST" name 2>/dev/null \
    | awk -v q="$queue" '$1 == q { found=1 } END { exit(found ? 0 : 1) }'
}

scale_deployment() {
  local dep="$1"
  local replicas="$2"
  if kubectl get deployment "$dep" -n "$APP_NS" >/dev/null 2>&1; then
    kubectl scale deployment "$dep" -n "$APP_NS" --replicas="$replicas"
  fi
}

wait_pods_gone() {
  local dep="$1"
  kubectl wait --for=delete pod -l "app=${dep}" -n "$APP_NS" --timeout=120s 2>/dev/null || true
}

delete_queue() {
  local queue="$1"
  echo "    Deleting queue ${queue} on vhost ${RABBITMQ_VHOST}..."
  kubectl exec -n "$APP_NS" "$RABBITMQ_POD" -- \
    rabbitmqctl delete_queue "$queue" -p "$RABBITMQ_VHOST" 2>/dev/null || true
}

echo "==> Reconciling RabbitMQ consumer queues (DLX=${DLX_EXCHANGE})..."
reconciled=0

for entry in "${CONSUMER_QUEUES[@]}"; do
  queue="${entry%%:*}"
  deployment="${entry##*:}"

  if ! queue_exists "$queue"; then
    echo "  [skip] ${queue} — not present (service will create on start)"
    continue
  fi

  if queue_has_expected_dlx "$queue"; then
    echo "  [ok]   ${queue} — DLX already configured"
    continue
  fi

  echo "  [fix]  ${queue} — legacy queue without expected DLX"
  scale_deployment "$deployment" 0
  wait_pods_gone "$deployment"
  delete_queue "$queue"
  reconciled=$((reconciled + 1))
done

if [[ "$reconciled" -gt 0 ]]; then
  echo "Reconciled ${reconciled} queue(s). Deploy will recreate them with DLX."
else
  echo "All consumer queues already match expected DLX configuration."
fi
