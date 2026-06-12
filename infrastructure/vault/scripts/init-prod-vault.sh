#!/usr/bin/env bash
# Initialize/unseal the single-node persistent Vault used by Droplet deploys.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$VAULT_DIR/../.." && pwd)"

CONTAINER_NAME="${VAULT_CONTAINER_NAME:-collabspace-vault-prod}"
INIT_FILE="${VAULT_INIT_FILE:-$VAULT_DIR/.vault-prod-init.json}"
READ_TOKEN_FILE="${VAULT_READ_TOKEN_FILE:-$VAULT_DIR/.vault-prod-read-token.json}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Vault container '$CONTAINER_NAME' is not running."
  echo "Start it first:"
  echo "  cd $REPO_ROOT/infrastructure/docker"
  echo "  docker compose -f docker-compose.vault.prod.yml up -d"
  exit 1
fi

status_json="$(docker exec "$CONTAINER_NAME" vault status -format=json 2>/dev/null || true)"
initialized="$(printf '%s' "$status_json" | jq -r '.initialized // false')"

if [[ "$initialized" != "true" ]]; then
  echo "Initializing Vault..."
  docker exec "$CONTAINER_NAME" vault operator init \
    -key-shares=1 \
    -key-threshold=1 \
    -format=json > "$INIT_FILE"
  chmod 600 "$INIT_FILE"
  echo "Saved init material to $INIT_FILE"
fi

unseal_key="$(jq -r '.unseal_keys_b64[0]' "$INIT_FILE")"
root_token="$(jq -r '.root_token' "$INIT_FILE")"

sealed="$(docker exec "$CONTAINER_NAME" vault status -format=json | jq -r '.sealed')"
if [[ "$sealed" == "true" ]]; then
  echo "Unsealing Vault..."
  docker exec "$CONTAINER_NAME" vault operator unseal "$unseal_key" >/dev/null
fi

echo "Ensuring KV v2 mount exists..."
docker exec -e VAULT_TOKEN="$root_token" "$CONTAINER_NAME" \
  vault secrets enable -path=secret kv-v2 >/dev/null 2>&1 || true

echo "Installing read-only policy..."
docker cp "$VAULT_DIR/policies/collabspace-prod-read.hcl" "$CONTAINER_NAME:/tmp/collabspace-prod-read.hcl"
docker exec -e VAULT_TOKEN="$root_token" "$CONTAINER_NAME" \
  vault policy write collabspace-prod-read /tmp/collabspace-prod-read.hcl >/dev/null

echo "Creating renewable read token for deploy sync..."
docker exec -e VAULT_TOKEN="$root_token" "$CONTAINER_NAME" \
  vault token create \
    -policy=collabspace-prod-read \
    -period=720h \
    -format=json > "$READ_TOKEN_FILE"
chmod 600 "$READ_TOKEN_FILE"

echo "Vault is ready."
echo "Root/init material: $INIT_FILE"
echo "Deploy read token:  $READ_TOKEN_FILE"
echo ""
echo "Set this in infrastructure/deploy/droplet.env:"
echo "VAULT_TOKEN=$(jq -r '.auth.client_token' "$READ_TOKEN_FILE")"
