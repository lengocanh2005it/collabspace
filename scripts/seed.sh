#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

echo "Running seed scripts from $ROOT_DIR"

echo "Seeding auth-service..."
sh "$ROOT_DIR/services/auth-service/scripts/seed.sh" || cd "$ROOT_DIR/services/auth-service" && pnpm run seed || true

echo "Seeding user-service..."
sh "$ROOT_DIR/services/user-service/scripts/seed.sh" || cd "$ROOT_DIR/services/user-service" && pnpm run seed || true

echo "Seeding workspace-service..."
sh "$ROOT_DIR/services/workspace-service/scripts/seed.sh" || cd "$ROOT_DIR/services/workspace-service" && pnpm run seed || true

echo "Seeding task-service..."
cd "$ROOT_DIR/services/task-service" && node seed.js || true

echo "Seed data inserted successfully for all services."
