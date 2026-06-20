#!/usr/bin/env bash
# Register (or update) Debezium task outbox connector — Phase 5M.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONNECT_URL="${DEBEZIUM_CONNECT_URL_HOST:-http://localhost:8083}"
CONNECTOR_JSON="$ROOT_DIR/infrastructure/kafka/connectors/task-outbox-connector.json"
CONNECTOR_NAME="collabspace-task-outbox"

echo "==> Debezium Connect: $CONNECT_URL"
curl -sf "$CONNECT_URL/connectors" >/dev/null || {
  echo "FAIL: Connect not reachable. Start kafka + debezium-connect first." >&2
  exit 1
}

if curl -sf "$CONNECT_URL/connectors/$CONNECTOR_NAME" >/dev/null 2>&1; then
  echo "==> Updating existing connector $CONNECTOR_NAME"
  jq -c '.config' "$CONNECTOR_JSON" | curl -sf -X PUT \
    -H "Content-Type: application/json" \
    --data-binary @- \
    "$CONNECT_URL/connectors/$CONNECTOR_NAME/config" >/dev/null
else
  echo "==> Creating connector $CONNECTOR_NAME"
  jq -c '{name: "'"$CONNECTOR_NAME"'", config: .config}' "$CONNECTOR_JSON" | curl -sf -X POST \
    -H "Content-Type: application/json" \
    --data-binary @- \
    "$CONNECT_URL/connectors" >/dev/null
fi

echo "==> Connector status"
curl -sf "$CONNECT_URL/connectors/$CONNECTOR_NAME/status" | jq .
echo "Registered $CONNECTOR_NAME."
