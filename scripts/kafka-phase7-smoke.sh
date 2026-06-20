#!/usr/bin/env bash
# Phase 7 smoke: DLQ topic, kafka-exporter metrics, optional Schema Registry.
set -euo pipefail

KAFKA_CONTAINER="${KAFKA_CONTAINER:-kafka}"
DLQ_TOPIC="${KAFKA_DLQ_TOPIC:-collabspace.dlq.events}"
EXPORTER_URL="${KAFKA_EXPORTER_URL:-http://localhost:9308/metrics}"

echo "==> Ensure DLQ topic exists: ${DLQ_TOPIC}"
docker exec "$KAFKA_CONTAINER" /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists \
  --topic "$DLQ_TOPIC" \
  --partitions 1 \
  --replication-factor 1

echo "==> Checking kafka-exporter at ${EXPORTER_URL}"
if ! curl -sf "$EXPORTER_URL" | grep -q kafka_consumergroup_lag; then
  echo "FAIL: kafka-exporter missing lag metrics. Start kafka-exporter from docker-compose.kafka.yml" >&2
  exit 1
fi
echo "OK: kafka-exporter lag metrics"

SCHEMA_URL="${SCHEMA_REGISTRY_URL:-http://localhost:8081/subjects}"
if curl -sf "$SCHEMA_URL" >/dev/null 2>&1; then
  echo "OK: Schema Registry reachable"
else
  echo "SKIP: Schema Registry not running (optional profile schema-registry)"
fi

echo "Phase 7 smoke test passed."
