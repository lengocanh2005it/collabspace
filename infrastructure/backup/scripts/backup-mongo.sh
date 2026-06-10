#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT_DIR="${ROOT}/infrastructure/backup/artifacts/$(date -u +%Y%m%dT%H%M%SZ)"
MONGO_CONTAINER="${MONGO_CONTAINER:-mongodb}"

mkdir -p "$OUT_DIR"

echo "==> Mongo archive dump"
docker exec "$MONGO_CONTAINER" mongodump --archive --gzip \
  > "${OUT_DIR}/mongo.archive.gz"

echo "Mongo backup written to ${OUT_DIR}/mongo.archive.gz"
