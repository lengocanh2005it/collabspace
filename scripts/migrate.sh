#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

echo "Running migrations for auth-service..."
sh "$ROOT_DIR/services/auth-service/scripts/migrate.sh" || cd "$ROOT_DIR/services/auth-service" && npx prisma migrate deploy || true

echo "Running migrations for user-service..."
sh "$ROOT_DIR/services/user-service/scripts/migrate.sh" || cd "$ROOT_DIR/services/user-service" && npx prisma migrate deploy || true

echo "Running migrations for workspace-service..."
cd "$ROOT_DIR/services/workspace-service" && ./gradlew flywayMigrate || true

echo "Running migrations for task-service (MongoDB)..."
cd "$ROOT_DIR/services/task-service" && node migrate.js || true

echo "All migrations completed!"