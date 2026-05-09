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
echo "MongoDB and Redis initialization are not required for the current auth/user bootstrap scripts."
echo "Root directory: $ROOT_DIR"
