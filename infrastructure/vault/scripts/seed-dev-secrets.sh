#!/usr/bin/env bash
# Seed CollabSpace dev secrets into HashiCorp Vault (KV v2).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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

JWT_SECRET="${COLLABSPACE_JWT_SECRET:-collabspace-dev-jwt-secret-change-me}"
SERVICE_JWT_SECRET="${COLLABSPACE_SERVICE_JWT_SECRET:-collabspace-dev-service-jwt-secret-change-me}"
POSTGRES_PASSWORD="${COLLABSPACE_POSTGRES_PASSWORD:-postgres}"
MONGO_USERNAME="${COLLABSPACE_MONGO_USERNAME:-admin}"
MONGO_PASSWORD="${COLLABSPACE_MONGO_PASSWORD:-password}"
REDIS_PASSWORD="${COLLABSPACE_REDIS_PASSWORD:-collabspace123}"
RABBITMQ_USERNAME="${COLLABSPACE_RABBITMQ_USERNAME:-guest}"
RABBITMQ_PASSWORD="${COLLABSPACE_RABBITMQ_PASSWORD:-guest}"
METRICS_AUTH_TOKEN="${COLLABSPACE_METRICS_AUTH_TOKEN:-}"

payload=$(cat <<EOF
{
  "data": {
    "jwt_secret": "$JWT_SECRET",
    "service_jwt_secret": "$SERVICE_JWT_SECRET",
    "postgres_password": "$POSTGRES_PASSWORD",
    "mongo_username": "$MONGO_USERNAME",
    "mongo_password": "$MONGO_PASSWORD",
    "redis_password": "$REDIS_PASSWORD",
    "rabbitmq_username": "$RABBITMQ_USERNAME",
    "rabbitmq_password": "$RABBITMQ_PASSWORD",
    "metrics_auth_token": "$METRICS_AUTH_TOKEN"
  }
}
EOF
)

echo "Seeding Vault KV at secret/data/$KV_PATH ..."
curl -sfS -X PUT \
  -H "X-Vault-Token: $VAULT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  "$VAULT_ADDR/v1/secret/data/$KV_PATH" >/dev/null

echo "Done. Verify: VAULT_ADDR=$VAULT_ADDR vault kv get secret/$KV_PATH"
