#!/usr/bin/env bash
# Stops Postgres briefly and verifies auth/workspace readiness degrades, then recovers.
set -euo pipefail

COMPOSE="docker compose -f infrastructure/docker/docker-compose.db.yml"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-collabspace-postgres}"

echo "==> Stopping Postgres ($POSTGRES_CONTAINER)"
docker stop "$POSTGRES_CONTAINER" >/dev/null

sleep 3
echo "==> Expect auth/workspace readiness 503"
curl -s -o /dev/null -w "auth: %{http_code}\n" http://localhost:3000/api/v1/auth/health/ready || true
curl -s -o /dev/null -w "workspace: %{http_code}\n" http://localhost:3002/api/v1/workspaces/health/ready || true

echo "==> Starting Postgres"
$COMPOSE up -d postgres
sleep 5

"$(dirname "$0")/verify-readiness.sh"
