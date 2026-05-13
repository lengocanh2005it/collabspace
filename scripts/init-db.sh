#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}

export PGPASSWORD="$POSTGRES_PASSWORD"

create_postgres_db() {
  db_name=$1
  echo "Ensuring PostgreSQL database $db_name exists..."
  psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d postgres \
    -tc "SELECT 1 FROM pg_database WHERE datname = '$db_name'" \
    | grep -q 1 \
    || psql \
      -h "$POSTGRES_HOST" \
      -p "$POSTGRES_PORT" \
      -U "$POSTGRES_USER" \
      -d postgres \
      -c "CREATE DATABASE $db_name"
}

create_postgres_db collabspace_auth
create_postgres_db collabspace_user
create_postgres_db collabspace_workspace

echo "PostgreSQL databases initialized."

echo "Initializing MongoDB for task service..."
if command -v mongosh >/dev/null 2>&1; then
    mongosh --eval "db.getSiblingDB('collabspace_task')" >/dev/null 2>&1 || true
else
    echo "mongosh not found, skipping mongo init."
fi

echo "Initializing Redis for notification service..."
if command -v redis-cli >/dev/null 2>&1; then
    redis-cli FLUSHALL >/dev/null 2>&1 || true
else
    echo "redis-cli not found, skipping redis init."
fi

echo "All database initialization tasks completed."