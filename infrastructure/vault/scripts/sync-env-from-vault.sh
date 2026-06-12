#!/usr/bin/env bash
# Pull shared secrets from Vault and update service .env files (local Docker dev).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$VAULT_DIR/../.." && pwd)"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^\s*#' "$file" | grep -v '^\s*$' | sed 's/\r$//')
  set +a
}

load_env_file "$VAULT_DIR/.env.example"
load_env_file "$VAULT_DIR/.env"

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-${VAULT_DEV_ROOT_TOKEN:-collabspace-dev-root}}"
KV_PATH="${VAULT_KV_PATH:-collabspace/dev}"

response=$(curl -sfS -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/secret/data/$KV_PATH")
jwt=$(echo "$response" | jq -r '.data.data.jwt_secret')
internal=$(echo "$response" | jq -r '.data.data.internal_service_token')
pg_pass=$(echo "$response" | jq -r '.data.data.postgres_password')
mongo_user=$(echo "$response" | jq -r '.data.data.mongo_username')
mongo_pass=$(echo "$response" | jq -r '.data.data.mongo_password')
redis_pass=$(echo "$response" | jq -r '.data.data.redis_password')
rmq_user=$(echo "$response" | jq -r '.data.data.rabbitmq_username')
rmq_pass=$(echo "$response" | jq -r '.data.data.rabbitmq_password')
metrics=$(echo "$response" | jq -r '.data.data.metrics_auth_token // ""')

set_env_key() {
  local file="$1" key="$2" value="$3"
  [[ -f "$file" ]] || return 0
  if grep -q "^${key}=" "$file"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "${file}.bak"
  else
    echo "${key}=${value}" >>"$file"
  fi
}

ensure_env() {
  local file="$1"
  if [[ ! -f "$file" && -f "${file}.example" ]]; then
    cp "${file}.example" "$file"
    echo "Created $file from .env.example"
  fi
}

AUTH_ENV="$REPO_ROOT/services/auth-service/.env"
USER_ENV="$REPO_ROOT/services/user-service/.env"
WS_ENV="$REPO_ROOT/services/workspace-service/.env"
TASK_ENV="$REPO_ROOT/services/task-service/.env"
NOTIF_ENV="$REPO_ROOT/services/notification-service/.env"
RABBITMQ_ENV="$REPO_ROOT/infrastructure/rabbitmq/.env"
REDIS_ENV="$REPO_ROOT/infrastructure/redis/.env"
REDIS_CONF="$REPO_ROOT/infrastructure/redis/redis.conf"

for f in "$AUTH_ENV" "$USER_ENV" "$WS_ENV" "$TASK_ENV" "$NOTIF_ENV" "$RABBITMQ_ENV" "$REDIS_ENV"; do
  ensure_env "$f"
done

set_env_key "$AUTH_ENV" "JWT_SECRET" "$jwt"
set_env_key "$NOTIF_ENV" "JWT_SECRET" "$jwt"

for f in "$USER_ENV" "$WS_ENV" "$TASK_ENV" "$NOTIF_ENV"; do
  set_env_key "$f" "INTERNAL_SERVICE_TOKEN" "$internal"
done

if [[ -n "$metrics" ]]; then
  for f in "$AUTH_ENV" "$USER_ENV" "$WS_ENV" "$TASK_ENV" "$NOTIF_ENV"; do
    set_env_key "$f" "METRICS_AUTH_TOKEN" "$metrics"
  done
fi

url_encode() {
  python3 -c "import urllib.parse; print(urllib.parse.quote('''$1''', safe=''))"
}

pg_user_enc=$(url_encode "postgres")
pg_pass_enc=$(url_encode "$pg_pass")
mongo_user_enc=$(url_encode "$mongo_user")
mongo_pass_enc=$(url_encode "$mongo_pass")
rmq_user_enc=$(url_encode "$rmq_user")
rmq_pass_enc=$(url_encode "$rmq_pass")

for f in "$AUTH_ENV" "$USER_ENV" "$WS_ENV"; do
  [[ -f "$f" ]] || continue
  sed -i.bak -E "s|(postgresql://)[^@]+@|\1${pg_user_enc}:${pg_pass_enc}@|" "$f" && rm -f "${f}.bak"
done

for f in "$TASK_ENV" "$NOTIF_ENV"; do
  [[ -f "$f" ]] || continue
  sed -i.bak -E "s|(mongodb://)[^@]+@|\1${mongo_user_enc}:${mongo_pass_enc}@|" "$f" && rm -f "${f}.bak"
done

for f in "$AUTH_ENV" "$USER_ENV" "$WS_ENV" "$TASK_ENV" "$NOTIF_ENV"; do
  [[ -f "$f" ]] || continue
  sed -i.bak -E "s|(amqp://)[^@]+@|\1${rmq_user_enc}:${rmq_pass_enc}@|" "$f" && rm -f "${f}.bak"
done

set_env_key "$AUTH_ENV" "REDIS_PASSWORD" "$redis_pass"
set_env_key "$NOTIF_ENV" "REDIS_PASSWORD" "$redis_pass"
set_env_key "$REDIS_ENV" "REDIS_PASSWORD" "$redis_pass"

set_env_key "$RABBITMQ_ENV" "RABBITMQ_DEFAULT_USER" "$rmq_user"
set_env_key "$RABBITMQ_ENV" "RABBITMQ_DEFAULT_PASS" "$rmq_pass"
set_env_key "$RABBITMQ_ENV" "RABBITMQ_DEFAULT_VHOST" "collabspace"

if [[ -f "$REDIS_CONF" ]]; then
  sed -i.bak -E "s|^requirepass .*$|requirepass ${redis_pass}|" "$REDIS_CONF" && rm -f "${REDIS_CONF}.bak"
fi

echo "Synced Vault secrets into service and infrastructure env files."
