#!/usr/bin/env bash
# Restore MongoDB archive (produced by backup-mongo.sh) into a running container.
# Usage: ./restore-mongo.sh <artifact-dir>
#   artifact-dir — path to a backup snapshot directory, e.g.
#                  infrastructure/backup/artifacts/20260619T120000Z
#
# Env vars (optional):
#   MONGO_CONTAINER  container name (default: mongodb)
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

MONGO_CONTAINER="${MONGO_CONTAINER:-mongodb}"
ARCHIVE="${ARTIFACT_DIR}/mongo.archive.gz"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "ERROR: archive file not found: $ARCHIVE"
  exit 1
fi

echo "==> Restore target container : $MONGO_CONTAINER"
echo "==> Archive                  : $ARCHIVE"
echo ""

echo "==> Dropping existing databases (task, notification)"
docker exec "$MONGO_CONTAINER" \
  mongosh --quiet --eval \
  "db.getSiblingDB('collabspace_task').dropDatabase(); db.getSiblingDB('collabspace_notification').dropDatabase();"

echo "==> Restoring from archive"
gunzip -c "$ARCHIVE" | docker exec -i "$MONGO_CONTAINER" \
  mongorestore --archive --gzip --drop

echo ""
echo "[OK] Mongo restore complete."
echo "Smoke: curl http://localhost:3003/api/v1/tasks/health/ready"
echo "       curl http://localhost:3004/api/v1/notifications/health/ready"
