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

required=(JWT_SECRET SERVICE_JWT_SECRET POSTGRES_PASSWORD MONGO_PASSWORD REDIS_PASSWORD RABBITMQ_PASSWORD RABBITMQ_USERNAME METRICS_AUTH_TOKEN AZURE_STORAGE_CONNECTION_STRING DO_SPACES_KEY DO_SPACES_SECRET)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing $key in $ENV_FILE"
    exit 1
  fi
done

BREVO_API_KEY="${BREVO_API_KEY:-}"

root_token="$(jq -r '.root_token' "$INIT_FILE")"
azure_b64="$(printf '%s' "$AZURE_STORAGE_CONNECTION_STRING" | base64 -w 0 2>/dev/null || printf '%s' "$AZURE_STORAGE_CONNECTION_STRING" | base64 | tr -d '\n')"

echo "Seeding Vault KV secret/$KV_PATH via kubectl exec..."
kubectl exec -n "$VAULT_NS" "$VAULT_POD" -- env \
  VAULT_ADDR=http://127.0.0.1:8200 \
  VAULT_TOKEN="$root_token" \
  KV_PATH="$KV_PATH" \
  JWT_SECRET="$JWT_SECRET" \
  SERVICE_JWT_SECRET="$SERVICE_JWT_SECRET" \
  POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  MONGO_PASSWORD="$MONGO_PASSWORD" \
  REDIS_PASSWORD="$REDIS_PASSWORD" \
  RABBITMQ_USERNAME="$RABBITMQ_USERNAME" \
  RABBITMQ_PASSWORD="$RABBITMQ_PASSWORD" \
  METRICS_AUTH_TOKEN="$METRICS_AUTH_TOKEN" \
  AZURE_B64="$azure_b64" \
  BREVO_API_KEY="$BREVO_API_KEY" \
  DO_SPACES_KEY="$DO_SPACES_KEY" \
  DO_SPACES_SECRET="$DO_SPACES_SECRET" \
  sh -ec '
    AZURE_STORAGE_CONNECTION_STRING="$(printf "%s" "$AZURE_B64" | base64 -d)"
    vault kv put "secret/${KV_PATH}" \
      jwt_secret="${JWT_SECRET}" \
      service_jwt_secret="${SERVICE_JWT_SECRET}" \
      postgres_password="${POSTGRES_PASSWORD}" \
      mongo_username="admin" \
      mongo_password="${MONGO_PASSWORD}" \
      redis_password="${REDIS_PASSWORD}" \
      rabbitmq_username="${RABBITMQ_USERNAME}" \
      rabbitmq_password="${RABBITMQ_PASSWORD}" \
      metrics_auth_token="${METRICS_AUTH_TOKEN}" \
      azure_storage_connection_string="${AZURE_STORAGE_CONNECTION_STRING}" \
      brevo_api_key="${BREVO_API_KEY}" \
      do_spaces_key="${DO_SPACES_KEY}" \
      do_spaces_secret="${DO_SPACES_SECRET}"
  '

echo "Done. Verify:"
echo "  kubectl exec -n $VAULT_NS $VAULT_POD -- vault kv get secret/$KV_PATH"
