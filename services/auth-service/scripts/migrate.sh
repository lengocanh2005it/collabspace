#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SERVICE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
SQL_DIR="$SCRIPT_DIR/sql"

if [ -f "$SERVICE_DIR/.env" ]; then
  export $(grep -v '^#' "$SERVICE_DIR/.env" | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for auth-service migration" >&2
  exit 1
fi

echo "Running auth-service SQL migrations..."

for migration in "$SQL_DIR"/*.sql; do
  echo "Applying $(basename "$migration")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "auth-service migration completed"
