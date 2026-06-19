#!/usr/bin/env bash
# Restore PostgreSQL dumps (produced by backup-postgres.sh) into a running container.
# Usage: ./restore-postgres.sh <artifact-dir>
#   artifact-dir — path to a backup snapshot directory, e.g.
#                  infrastructure/backup/artifacts/20260619T120000Z
#
# Env vars (optional):
#   POSTGRES_CONTAINER  container name (default: postgres)
#   POSTGRES_USER       superuser (default: postgres)
set -euo pipefail

ARTIFACT_DIR="${1:-}"
if [[ -z "$ARTIFACT_DIR" ]]; then
  echo "Usage: $0 <artifact-dir>"
  echo "  e.g. $0 infrastructure/backup/artifacts/20260619T120000Z"
  exit 1
fi

if [[ ! -d "$ARTIFACT_DIR" ]]; then
  echo "ERROR: artifact directory not found: $ARTIFACT_DIR"
  exit 1
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

DATABASES=(
  collabspace_auth
  collabspace_user
  collabspace_workspace
)

echo "==> Restore target container : $POSTGRES_CONTAINER"
echo "==> Artifact directory       : $ARTIFACT_DIR"
echo ""

for db in "${DATABASES[@]}"; do
  dump_file="${ARTIFACT_DIR}/${db}.sql.gz"

  if [[ ! -f "$dump_file" ]]; then
    echo "[SKIP] $db — dump file not found: $dump_file"
    continue
  fi

  echo "==> Dropping and recreating $db"
  docker exec "$POSTGRES_CONTAINER" \
    psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS ${db};" postgres
  docker exec "$POSTGRES_CONTAINER" \
    psql -U "$POSTGRES_USER" -c "CREATE DATABASE ${db};" postgres

  echo "==> Restoring $db from $dump_file"
  gunzip -c "$dump_file" | docker exec -i "$POSTGRES_CONTAINER" \
    psql -U "$POSTGRES_USER" -d "$db" -q

  echo "[OK] $db restored"
done

echo ""
echo "Postgres restore complete. Run migrations if schema version differs:"
echo "  pnpm --filter auth-service      run migrate"
echo "  pnpm --filter user-service      run migrate"
echo "  pnpm --filter workspace-service run migrate"
