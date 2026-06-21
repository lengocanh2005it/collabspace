#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/droplet.env"

EXTERNAL_GHCR_USERNAME="${GHCR_USERNAME:-}"
EXTERNAL_GHCR_TOKEN="${GHCR_TOKEN:-}"
EXTERNAL_IMAGE_REGISTRY="${COLLABSPACE_IMAGE_REGISTRY:-}"
EXTERNAL_IMAGE_TAG="${COLLABSPACE_IMAGE_TAG:-}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -n "$EXTERNAL_GHCR_USERNAME" ]]; then
  GHCR_USERNAME="$EXTERNAL_GHCR_USERNAME"
fi

if [[ -n "$EXTERNAL_GHCR_TOKEN" ]]; then
  GHCR_TOKEN="$EXTERNAL_GHCR_TOKEN"
fi

if [[ -n "$EXTERNAL_IMAGE_REGISTRY" ]]; then
  COLLABSPACE_IMAGE_REGISTRY="$EXTERNAL_IMAGE_REGISTRY"
fi

if [[ -n "$EXTERNAL_IMAGE_TAG" ]]; then
  COLLABSPACE_IMAGE_TAG="$EXTERNAL_IMAGE_TAG"
fi

cd "$ROOT_DIR"

if [[ "${USE_VAULT_SYNC:-true}" == "true" ]]; then
  echo "Syncing service .env files from HashiCorp Vault..."
  VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}" \
  VAULT_TOKEN="${VAULT_TOKEN:-collabspace-dev-root}" \
  VAULT_KV_PATH="${VAULT_KV_PATH:-collabspace/dev}" \
    bash infrastructure/vault/scripts/sync-env-from-vault.sh
fi

required_files=(
  "services/auth-service/.env"
  "services/user-service/.env"
  "services/workspace-service/.env"
  "services/task-service/.env"
  "services/notification-service/.env"
)

missing=()
for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || missing+=("$file")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required env files:"
  printf '  - %s\n' "${missing[@]}"
  echo "Copy from .env.example and set production-safe secrets before deploying."
  exit 1
fi

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

COMPOSE_FILES=(
  -f infrastructure/docker/docker-compose.yml
  -f infrastructure/docker/docker-compose.db.yml
  -f infrastructure/docker/docker-compose.prod.yml
)

docker compose "${COMPOSE_FILES[@]}" pull auth-service user-service workspace-service task-service notification-service
docker compose "${COMPOSE_FILES[@]}" up -d --no-build postgres mongo redis

if [[ "${RUN_MIGRATIONS:-true}" == "true" ]]; then
  echo "Running database migrations..."
  docker compose "${COMPOSE_FILES[@]}" run --rm auth-service pnpm run migrate:prod
  docker compose "${COMPOSE_FILES[@]}" run --rm user-service pnpm run migrate:prod
  docker compose "${COMPOSE_FILES[@]}" run --rm workspace-service pnpm run migrate:prod
fi

if [[ "${RUN_SEED:-false}" == "true" ]]; then
  echo "Running seed pipeline..."
  docker compose "${COMPOSE_FILES[@]}" run --rm auth-service pnpm run seed:prod
  docker compose "${COMPOSE_FILES[@]}" run --rm user-service pnpm run seed:prod
  docker compose "${COMPOSE_FILES[@]}" run --rm workspace-service pnpm run seed:prod
  docker compose "${COMPOSE_FILES[@]}" run --rm task-service pnpm run seed:prod
  docker compose "${COMPOSE_FILES[@]}" run --rm notification-service pnpm run seed:prod
fi

docker compose "${COMPOSE_FILES[@]}" up -d --no-build

echo "Waiting for services to settle..."
sleep 20

docker compose "${COMPOSE_FILES[@]}" ps

echo "Checking gateway health..."
curl -fsS http://localhost/api/v1/auth/health >/dev/null
curl -fsS http://localhost/api/v1/auth/health/ready >/dev/null

echo "Deploy finished."
