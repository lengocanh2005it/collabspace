#!/usr/bin/env bash
# Create a TypeORM class migration for auth, user, or workspace service.
# Usage: ./scripts/typeorm-migrate/create-migration.sh <auth|user|workspace> <MigrationName>
set -euo pipefail

SERVICE="${1:?service required: auth | user | workspace}"
NAME="${2:?migration class suffix required, e.g. AddUserSearchIndexes}"

case "$SERVICE" in
  auth | user | workspace) ;;
  *)
    echo "Unknown service: $SERVICE (expected auth, user, or workspace)" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE_DIR="$ROOT/services/${SERVICE}-service"

if [[ ! -d "$SERVICE_DIR/migrations" ]]; then
  mkdir -p "$SERVICE_DIR/migrations"
fi

cd "$SERVICE_DIR"
pnpm exec typeorm migration:create "./migrations/${NAME}"
echo "Created migration under services/${SERVICE}-service/migrations/"
