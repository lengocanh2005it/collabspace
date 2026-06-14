#!/usr/bin/env bash
# Revert the last applied TypeORM migration for auth, user, or workspace.
# Usage: ./scripts/typeorm-migrate/revert-migration.sh <auth|user|workspace>
set -euo pipefail

SERVICE="${1:?service required: auth | user | workspace}"

case "$SERVICE" in
  auth | user | workspace) ;;
  *)
    echo "Unknown service: $SERVICE (expected auth, user, or workspace)" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVICE_DIR="$ROOT/services/${SERVICE}-service"

cd "$SERVICE_DIR"
pnpm run migrate:revert
