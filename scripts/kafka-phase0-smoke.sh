#!/usr/bin/env sh
# Phase 0 smoke test: Kafka broker + Debezium Connect REST + produce/consume.
set -eu

CONNECT_URL="${DEBEZIUM_CONNECT_URL_HOST:-http://localhost:8083}"
KAFKA_CONTAINER="${KAFKA_CONTAINER:-kafka}"
TOPIC="${KAFKA_SMOKE_TOPIC:-collabspace.test}"
MESSAGE="${KAFKA_SMOKE_MESSAGE:-collabspace-phase0-ok}"

echo "==> Checking Debezium Connect at ${CONNECT_URL}"
if ! curl -sf "${CONNECT_URL}/connectors" >/dev/null; then
  echo "FAIL: Debezium Connect not reachable at ${CONNECT_URL}" >&2
  echo "Start: docker compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.db.yml -f infrastructure/docker/docker-compose.kafka.yml up -d kafka debezium-connect" >&2
  exit 1
fi
echo "OK: Connect REST /connectors"

echo "==> Checking Kafka container ${KAFKA_CONTAINER}"
if ! docker exec "${KAFKA_CONTAINER}" /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 >/dev/null 2>&1; then
  echo "FAIL: Kafka broker not healthy in container ${KAFKA_CONTAINER}" >&2
  exit 1
fi
echo "OK: Kafka broker"

echo "==> Creating topic ${TOPIC} (if missing)"
docker exec "${KAFKA_CONTAINER}" /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --if-not-exists \
  --topic "${TOPIC}" \
  --partitions 1 \
  --replication-factor 1

echo "==> Producing test message"
printf '%s\n' "${MESSAGE}" | docker exec -i "${KAFKA_CONTAINER}" /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic "${TOPIC}"

echo "==> Consuming one message"
CONSUMED="$(docker exec "${KAFKA_CONTAINER}" /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic "${TOPIC}" \
  --from-beginning \
  --max-messages 1 \
  --timeout-ms 15000 2>/dev/null | tail -n 1 || true)"

if [ "${CONSUMED}" != "${MESSAGE}" ]; then
  echo "FAIL: expected '${MESSAGE}', got '${CONSUMED}'" >&2
  exit 1
fi

echo "OK: produce/consume verified"
echo "Phase 0 smoke test passed."
