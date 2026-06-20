#!/usr/bin/env bash
# Phase 0M DoD smoke: Mongo replica set rs0 + task/notification Mongo connectivity.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_URL="${TASK_HEALTH_URL:-http://localhost:3003/api/v1/tasks/health/ready}"
NOTIF_URL="${NOTIF_HEALTH_URL:-http://localhost:3004/api/v1/notifications/health/ready}"

echo "==> Mongo replica set rs0"
bash "$ROOT/scripts/init-mongo-rs.sh"

echo "==> Mongo multi-document transaction (requires replica set)"
docker exec mongo mongosh -u admin -p password --authenticationDatabase admin --quiet --eval "
const session = db.getMongo().startSession();
session.withTransaction(() => {
  session.getDatabase('collabspace_task').getCollection('_phase0m_txn_probe').insertOne({ probe: true, at: new Date() });
});
print('OK: withTransaction');
"

echo "==> task-service readiness $TASK_URL"
code="$(curl -s -o /dev/null -w '%{http_code}' "$TASK_URL" || true)"
if [[ "$code" != "200" ]]; then
  echo "FAIL: task-service HTTP $code at $TASK_URL" >&2
  exit 1
fi
echo "OK: task-service ready"

echo "==> notification-service readiness $NOTIF_URL"
code="$(curl -s -o /dev/null -w '%{http_code}' "$NOTIF_URL" || true)"
if [[ "$code" != "200" ]]; then
  echo "FAIL: notification-service HTTP $code at $NOTIF_URL" >&2
  exit 1
fi
echo "OK: notification-service ready"

echo ""
echo "Phase 0M smoke PASSED (rs0 + transactions + Mongo-backed services healthy)"
