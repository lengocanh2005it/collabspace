#!/usr/bin/env bash
# Download a backup snapshot from DO Spaces and restore into local Docker containers.
#
# Usage:
#   ./restore-from-spaces.sh <snapshot-stamp>
#
# Args:
#   snapshot-stamp  Timestamp directory in Spaces, e.g. 20260620T020000Z
#                   Leave blank to list available snapshots.
#
# Required env vars:
#   DO_SPACES_KEY       DO Spaces access key
#   DO_SPACES_SECRET    DO Spaces secret key
#
# Optional env vars:
#   SPACES_ENDPOINT     default: https://sgp1.digitaloceanspaces.com
#   SPACES_BUCKET       default: collabspace-bucket
#   SPACES_REGION       default: sgp1
#   SPACES_PREFIX       default: backups
#   POSTGRES_CONTAINER  default: postgres
#   MONGO_CONTAINER     default: mongodb
#   ARTIFACT_DIR        local download dir, default: /tmp/collabspace-restore-$$
set -euo pipefail

ENDPOINT="${SPACES_ENDPOINT:-https://sgp1.digitaloceanspaces.com}"
BUCKET="${SPACES_BUCKET:-collabspace-bucket}"
REGION="${SPACES_REGION:-sgp1}"
PREFIX="${SPACES_PREFIX:-backups}"

if [[ -z "${DO_SPACES_KEY:-}" || -z "${DO_SPACES_SECRET:-}" ]]; then
  echo "ERROR: DO_SPACES_KEY and DO_SPACES_SECRET must be set"
  exit 1
fi

export AWS_ACCESS_KEY_ID="$DO_SPACES_KEY"
export AWS_SECRET_ACCESS_KEY="$DO_SPACES_SECRET"
export AWS_DEFAULT_REGION="$REGION"

_aws() { aws --endpoint-url "$ENDPOINT" "$@"; }

STAMP="${1:-}"

if [[ -z "$STAMP" ]]; then
  echo "Available Postgres snapshots:"
  _aws s3 ls "s3://${BUCKET}/${PREFIX}/postgres/" | awk '{print $2}' | sed 's|/$||'
  echo ""
  echo "Available Mongo snapshots:"
  _aws s3 ls "s3://${BUCKET}/${PREFIX}/mongo/" | awk '{print $2}' | sed 's|/$||'
  echo ""
  echo "Usage: $0 <YYYYMMDD>/<YYYYMMDDTHHMMSSZ>"
  exit 0
fi

ARTIFACT_DIR="${ARTIFACT_DIR:-/tmp/collabspace-restore-$$}"
mkdir -p "$ARTIFACT_DIR"
echo "==> Downloading to $ARTIFACT_DIR"

# ── Download PostgreSQL dumps ─────────────────────────────────────────────────
PG_SRC="s3://${BUCKET}/${PREFIX}/postgres/${STAMP}/"
echo "==> Syncing Postgres from ${PG_SRC}"
_aws s3 sync "$PG_SRC" "$ARTIFACT_DIR/" --exclude "*" --include "*.sql.gz"

if ls "$ARTIFACT_DIR"/*.sql.gz 1>/dev/null 2>&1; then
  echo "==> Postgres dumps downloaded: $(ls "$ARTIFACT_DIR"/*.sql.gz | wc -l) files"
else
  echo "WARNING: no Postgres .sql.gz found at ${PG_SRC}"
fi

# ── Download MongoDB archive ──────────────────────────────────────────────────
MONGO_SRC="s3://${BUCKET}/${PREFIX}/mongo/${STAMP}/mongo.archive.gz"
echo "==> Downloading Mongo from ${MONGO_SRC}"
if _aws s3 cp "$MONGO_SRC" "$ARTIFACT_DIR/mongo.archive.gz" 2>/dev/null; then
  echo "==> Mongo archive downloaded"
else
  echo "WARNING: mongo.archive.gz not found at ${MONGO_SRC}"
fi

# ── Restore ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "==> Restoring Postgres..."
"$SCRIPT_DIR/restore-postgres.sh" "$ARTIFACT_DIR"

echo ""
echo "==> Restoring Mongo..."
"$SCRIPT_DIR/restore-mongo.sh" "$ARTIFACT_DIR"

echo ""
echo "==> Done. Artifact dir: $ARTIFACT_DIR"
echo "    Next: run migrations + restart app services."
echo "    See infrastructure/resilience/drills/README.md Drill 2 for full steps."
