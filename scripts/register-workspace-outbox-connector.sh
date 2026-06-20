#!/usr/bin/env sh
# Register (or update) Debezium workspace outbox connector — Phase 1.
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CONNECT_URL="${DEBEZIUM_CONNECT_URL_HOST:-http://localhost:8083}"
CONNECTOR_JSON="${ROOT_DIR}/infrastructure/kafka/connectors/workspace-outbox-connector.json"
CONNECTOR_NAME="collabspace-workspace-outbox"

echo "==> Debezium Connect: ${CONNECT_URL}"
if ! curl -sf "${CONNECT_URL}/connectors" >/dev/null; then
  echo "FAIL: Connect not reachable. Start kafka + debezium-connect first." >&2
  exit 1
fi

if curl -sf "${CONNECT_URL}/connectors/${CONNECTOR_NAME}" >/dev/null 2>&1; then
  echo "==> Updating existing connector ${CONNECTOR_NAME}"
  curl -sf -X PUT "${CONNECT_URL}/connectors/${CONNECTOR_NAME}/config" \
    -H "Content-Type: application/json" \
    -d "$(jq -c '.config' "${CONNECTOR_JSON}")"
else
  echo "==> Creating connector ${CONNECTOR_NAME}"
  curl -sf -X POST "${CONNECT_URL}/connectors" \
    -H "Content-Type: application/json" \
    -d @"${CONNECTOR_JSON}"
fi

echo ""
echo "==> Connector status"
curl -sf "${CONNECT_URL}/connectors/${CONNECTOR_NAME}/status" | jq .
echo "Registered ${CONNECTOR_NAME}."
