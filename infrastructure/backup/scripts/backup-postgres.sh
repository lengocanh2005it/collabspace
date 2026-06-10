#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT_DIR="${ROOT}/infrastructure/backup/artifacts/$(date -u +%Y%m%dT%H%M%SZ)"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

DATABASES=(
  collabspace_auth
  collabspace_user
  collabspace_workspace
)

mkdir -p "$OUT_DIR"

for db in "${DATABASES[@]}"; do
  echo "==> Dumping $db"
  docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$db" --no-owner --no-acl \
    | gzip > "${OUT_DIR}/${db}.sql.gz"
done

echo "Postgres backups written to $OUT_DIR"
