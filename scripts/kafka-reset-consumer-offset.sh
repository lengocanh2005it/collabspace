#!/usr/bin/env bash
# Reset a Kafka consumer group offset (dev replay / debug only).
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <consumer-group> <topic> [earliest|latest]" >&2
  exit 1
fi

GROUP="$1"
TOPIC="$2"
OFFSET="${3:-earliest}"
KAFKA_CONTAINER="${KAFKA_CONTAINER:-kafka}"

echo "==> Resetting group=${GROUP} topic=${TOPIC} to ${OFFSET}"
docker exec "$KAFKA_CONTAINER" /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group "$GROUP" \
  --topic "$TOPIC" \
  --reset-offsets \
  --to-"$OFFSET" \
  --execute

echo "OK: offset reset. Restart the consumer service to reprocess."
