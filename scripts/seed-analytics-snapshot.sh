#!/bin/sh
# Bootstrap analytics-service platform_snapshots from current service counts.
# Run ONCE after first deploy into an environment that already has data.
# Usage:
#   BASE_URL=https://collabspace.ngocanh2005it.site/api/v1 \
#   ADMIN_TOKEN=<platform_admin bearer token> \
#   ./scripts/seed-analytics-snapshot.sh
set -eu

BASE_URL="${BASE_URL:-http://localhost/api/v1}"
ANALYTICS_URL="${ANALYTICS_URL:-http://localhost:3005/api/v1}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: ADMIN_TOKEN is required (platform_admin bearer token)"
  exit 1
fi

echo "==> Fetching counts from services at $BASE_URL ..."

# --- Users ---
USERS_TOTAL=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/auth/admin/users?limit=1" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2 || echo "0")

# --- Workspaces ---
WORKSPACES_TOTAL=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/workspaces/admin/all?limit=1" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2 || echo "0")

echo "  users.total       = ${USERS_TOTAL:-0}"
echo "  workspaces.total  = ${WORKSPACES_TOTAL:-0}"
echo ""
echo "NOTE: counts above are best-effort (grep on JSON). For accurate bootstrap,"
echo "  use the MongoDB shell to upsert platform_snapshots directly:"
echo ""
cat <<'MONGO'
# Connect to analytics MongoDB, then:
db.platform_snapshots.updateOne(
  { _id: "global" },
  {
    $set: {
      "users.total": <USER_COUNT>,
      "users.active": <ACTIVE_COUNT>,
      "users.banned": 0,
      "users.withoutWorkspace": 0,
      "users.activeLast30d": 0,
      "workspaces.total": <WORKSPACE_COUNT>,
      "workspaces.totalMembers": 0,
      "workspaces.avgMembersPerWorkspace": 0,
      "projects.total": 0,
      "tasks.total": 0,
      "tasks.byStatus.TODO": 0,
      "tasks.byStatus.DOING": 0,
      "tasks.byStatus.DONE": 0,
      updatedAt: new Date()
    }
  },
  { upsert: true }
)
MONGO

echo ""
echo "After bootstrap, analytics-service Kafka consumers will keep snapshot"
echo "up-to-date for all new events automatically."
