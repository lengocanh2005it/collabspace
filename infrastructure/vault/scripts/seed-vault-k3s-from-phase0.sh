#!/usr/bin/env bash
# Seed Vault KV secret/collabspace/prod từ infrastructure/deploy/phase0.env (Phase 2).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${PHASE0_ENV:-$REPO_ROOT/infrastructure/deploy/phase0.env}"
VAULT_NS="${VAULT_NS:-vault}"
VAULT_POD="${VAULT_POD:-vault-0}"
INIT_FILE="${VAULT_INIT_FILE:-$SCRIPT_DIR/../.vault-k3s-init.json}"
KV_PATH="${VAULT_KV_PATH:-collabspace/prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create from phase0.env.example"
  exit 1
fi

if [[ ! -f "$INIT_FILE" ]]; then
  echo "Missing $INIT_FILE — run vault-eso-phase2.sh first"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(JWT_SECRET INTERNAL_SERVICE_TOKEN POSTGRES_PASSWORD MONGO_PASSWORD REDIS_PASSWORD RABBITMQ_PASSWORD RABBITMQ_USERNAME METRICS_AUTH_TOKEN AZURE_STORAGE_CONNECTION_STRING)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing $key in $ENV_FILE"
    exit 1
  fi
done

root_token="$(jq -r '.root_token' "$INIT_FILE")"

echo "Seeding Vault KV secret/$KV_PATH via kubectl exec..."
kubectl exec -n "$VAULT_NS" "$VAULT_POD" -- sh -c "
  export VAULT_ADDR=http://127.0.0.1:8200
  export VAULT_TOKEN='$root_token'
  vault kv put secret/$KV_PATH \
    jwt_secret='$JWT_SECRET' \
    internal_service_token='$INTERNAL_SERVICE_TOKEN' \
    postgres_password='$POSTGRES_PASSWORD' \
    mongo_username='admin' \
    mongo_password='$MONGO_PASSWORD' \
    redis_password='$REDIS_PASSWORD' \
    rabbitmq_username='$RABBITMQ_USERNAME' \
    rabbitmq_password='$RABBITMQ_PASSWORD' \
    metrics_auth_token='$METRICS_AUTH_TOKEN' \
    azure_storage_connection_string='$AZURE_STORAGE_CONNECTION_STRING'
"

echo "Done. Verify:"
echo "  kubectl exec -n $VAULT_NS $VAULT_POD -- vault kv get secret/$KV_PATH"
