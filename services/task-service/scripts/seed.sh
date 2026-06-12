#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SERVICE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$SERVICE_DIR"
echo "Seeding task-service..."
if [ "${SEED_MODE:-dev}" = "prod" ]; then
  pnpm run seed:prod
else
  pnpm run seed
fi
