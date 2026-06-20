#!/usr/bin/env bash
# Initialize (or verify) MongoDB replica set rs0 for local Docker.
# Usage: ./scripts/init-mongo-rs.sh
# Requires: mongo container running with --replSet rs0 (docker-compose.db.yml).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MONGO_HOST="${MONGO_HOST:-mongo}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_USER="${MONGO_USER:-admin}"
MONGO_PASS="${MONGO_PASS:-password}"

if ! docker ps --format '{{.Names}}' | grep -qx mongo; then
  echo "mongo container is not running. Start stack first:" >&2
  echo "  cd infrastructure/docker && docker compose -f docker-compose.db.yml up -d mongo" >&2
  exit 1
fi

docker cp "$ROOT/infrastructure/docker/mongo/init-replica-set.js" mongo:/tmp/init-replica-set.js

docker exec mongo mongosh \
  --host "$MONGO_HOST" \
  --port "$MONGO_PORT" \
  -u "$MONGO_USER" \
  -p "$MONGO_PASS" \
  --authenticationDatabase admin \
  --file /tmp/init-replica-set.js

docker exec mongo mongosh \
  -u "$MONGO_USER" \
  -p "$MONGO_PASS" \
  --authenticationDatabase admin \
  --quiet \
  --eval "const s = rs.status(); print('rs.status().ok =', s.ok); quit(s.ok === 1 ? 0 : 1)"

echo "Mongo replica set rs0 OK"
