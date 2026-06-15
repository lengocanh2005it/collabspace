#!/usr/bin/env bash
# Reconcile RabbitMQ consumer queues before app rollouts.
# Deletes legacy queues missing DLX args, ensures DLQs/exchanges, and binds
# notification-service to integration event routing keys.
set -euo pipefail

APP_NS="${APP_NS:-collabspace}"
RABBITMQ_POD="${RABBITMQ_POD:-rabbitmq-0}"
RABBITMQ_VHOST="${RABBITMQ_VHOST:-collabspace}"
EVENT_EXCHANGE="${RABBITMQ_EVENT_EXCHANGE:-collabspace_exchange}"
DLX_EXCHANGE="${RABBITMQ_DLX_EXCHANGE:-collabspace_dlx}"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

# queue_name:deployment_name
CONSUMER_QUEUES=(
  "auth-service:auth-service"
  "user-service:user-service"
  "task-service:task-service"
  "notification-service:notification-service"
)

# queue_name:routing_key
NOTIFICATION_EVENT_BINDINGS=(
  "notification-service:task_assigned"
  "notification-service:workspace_invited"
  "notification-service:workspace_deleted"
  "notification-service:comment_created"
  "notification-service:comment_mentioned"
  "notification-service:user_registered"
  "notification-service:user_profile_updated"
)

# queue_name:routing_key
TASK_EVENT_BINDINGS=(
  "task-service:workspace_deleted"
  "task-service:user_registered"
  "task-service:user_profile_updated"
)

api_path_escape() {
  printf '%s' "$1" | sed 's#/#%2F#g'
}

rabbitmq_api() {
  local method="$1"
  local path="$2"
  local body="$3"

  kubectl exec -n "$APP_NS" "$RABBITMQ_POD" -- sh -lc '
method="$1"
path="$2"
body="$3"
curl -fsS \
  -u "${RABBITMQ_USERNAME}:${RABBITMQ_PASSWORD}" \
  -H "content-type: application/json" \
  -X "$method" \
  --data "$body" \
  "http://127.0.0.1:15672/api/${path}" >/dev/null
' sh "$method" "$path" "$body"
}

ensure_exchange() {
  local exchange="$1"
  local type="$2"
  local vhost
  vhost="$(api_path_escape "$RABBITMQ_VHOST")"

  rabbitmq_api PUT \
    "exchanges/${vhost}/$(api_path_escape "$exchange")" \
    "{\"type\":\"${type}\",\"durable\":true,\"auto_delete\":false,\"arguments\":{}}"
}

ensure_queue_with_dlx() {
  local queue="$1"
  local dlq="${queue}.dlq"
  local vhost
  vhost="$(api_path_escape "$RABBITMQ_VHOST")"

  rabbitmq_api PUT \
    "queues/${vhost}/$(api_path_escape "$dlq")" \
    '{"durable":true,"auto_delete":false,"arguments":{}}'

  rabbitmq_api POST \
    "bindings/${vhost}/e/$(api_path_escape "$DLX_EXCHANGE")/q/$(api_path_escape "$dlq")" \
    "{\"routing_key\":\"${dlq}\",\"arguments\":{}}"

  rabbitmq_api PUT \
    "queues/${vhost}/$(api_path_escape "$queue")" \
    "{\"durable\":true,\"auto_delete\":false,\"arguments\":{\"x-dead-letter-exchange\":\"${DLX_EXCHANGE}\",\"x-dead-letter-routing-key\":\"${dlq}\"}}"
}

ensure_queue_binding() {
  local queue="$1"
  local routing_key="$2"
  local vhost
  vhost="$(api_path_escape "$RABBITMQ_VHOST")"

  rabbitmq_api POST \
    "bindings/${vhost}/e/$(api_path_escape "$EVENT_EXCHANGE")/q/$(api_path_escape "$queue")" \
    "{\"routing_key\":\"${routing_key}\",\"arguments\":{}}"
}

queue_arguments() {
  local queue="$1"
  kubectl exec -n "$APP_NS" "$RABBITMQ_POD" -- \
    rabbitmqctl list_queues -p "$RABBITMQ_VHOST" name arguments --formatter json 2>/dev/null \
    | python3 -c "
import json, sys

def normalize_args(raw):
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list):
        out = {}
        for item in raw:
            if isinstance(item, (list, tuple)) and len(item) == 2:
                out[str(item[0])] = str(item[1])
        return out
    return {}

target = sys.argv[1]
for row in json.load(sys.stdin):
    if row.get('name') == target:
        print(json.dumps(normalize_args(row.get('arguments') or {})))
        break
else:
    print('{}')
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

echo "==> Ensuring RabbitMQ exchanges, DLQs, and notification bindings..."
ensure_exchange "$EVENT_EXCHANGE" topic
ensure_exchange "$DLX_EXCHANGE" direct

for entry in "${CONSUMER_QUEUES[@]}"; do
  queue="${entry%%:*}"
  ensure_queue_with_dlx "$queue"
done

for binding in "${NOTIFICATION_EVENT_BINDINGS[@]}"; do
  queue="${binding%%:*}"
  routing_key="${binding##*:}"
  ensure_queue_binding "$queue" "$routing_key"
  echo "  [ok]   ${EVENT_EXCHANGE} -> ${queue} (${routing_key})"
done

for binding in "${TASK_EVENT_BINDINGS[@]}"; do
  queue="${binding%%:*}"
  routing_key="${binding##*:}"
  ensure_queue_binding "$queue" "$routing_key"
  echo "  [ok]   ${EVENT_EXCHANGE} -> ${queue} (${routing_key})"
done

if [[ "$reconciled" -gt 0 ]]; then
  echo "Reconciled ${reconciled} queue(s). Deploy will recreate them with DLX."
else
  echo "All consumer queues already match expected DLX configuration."
fi
