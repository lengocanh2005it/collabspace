#!/usr/bin/env bash
# Start local Docker stack with Vault bootstrap (.env config + .env.vault secrets).
#
# Usage (from repo root):
#   ./scripts/docker-local-up.sh              # built images (default)
#   ./scripts/docker-local-up.sh --kafka
#   ./scripts/docker-local-up.sh --dev        # hot-reload override
#   ./scripts/docker-local-up.sh --build
#   ./scripts/docker-local-up.sh --skip-vault

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCKER_DIR="$ROOT/infrastructure/docker"
SKIP_VAULT=false
DEV=false
BUILD=false
KAFKA=false
MONITORING=false
TRAEFIK=false

for arg in "$@"; do
  case "$arg" in
    --skip-vault) SKIP_VAULT=true ;;
    --dev) DEV=true ;;
    --build) BUILD=true ;;
    --kafka) KAFKA=true ;;
    --monitoring) MONITORING=true ;;
    --traefik) TRAEFIK=true ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--skip-vault] [--dev] [--build] [--kafka] [--monitoring] [--traefik]" >&2
      exit 1
      ;;
  esac
done

if [[ "$SKIP_VAULT" != "true" ]]; then
  echo "==> Vault bootstrap..."
  if command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -File "$ROOT/infrastructure/vault/scripts/reset-local-env-from-vault.ps1"
  else
    docker compose -f "$DOCKER_DIR/docker-compose.vault.yml" up -d
    sleep 2
    bash "$ROOT/infrastructure/vault/scripts/seed-dev-secrets.sh"
    pwsh -NoProfile -File "$ROOT/infrastructure/vault/scripts/strip-vault-secrets-from-env.ps1"
    pwsh -NoProfile -File "$ROOT/infrastructure/vault/scripts/sync-env-from-vault.ps1"
  fi
fi

COMPOSE_ARGS=(
  -f docker-compose.yml
  -f docker-compose.db.yml
)
if [[ "$DEV" == "true" ]]; then
  echo "==> Dev mode: hot-reload (override.yml)"
  COMPOSE_ARGS+=(-f docker-compose.override.yml)
else
  echo "==> Built images: Dockerfile.service"
  COMPOSE_ARGS+=(-f docker-compose.local.yml)
fi
[[ "$KAFKA" == "true" ]] && COMPOSE_ARGS+=(-f docker-compose.kafka.yml)
[[ "$MONITORING" == "true" && "$DEV" == "true" ]] && COMPOSE_ARGS+=(-f docker-compose.monitoring.yml)
[[ "$TRAEFIK" == "true" ]] && COMPOSE_ARGS+=(-f docker-compose.traefik.yml)

UP_ARGS=(up -d)
[[ "$BUILD" == "true" ]] && UP_ARGS+=(--build)

echo "==> Starting Docker stack..."
cd "$DOCKER_DIR"
docker compose "${COMPOSE_ARGS[@]}" "${UP_ARGS[@]}"

echo "==> Stack is up. Check: cd infrastructure/docker && docker compose ps"
