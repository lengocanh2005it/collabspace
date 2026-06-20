#!/usr/bin/env bash
# Replay DLQ envelopes from collabspace.dlq.events back to sourceTopic.
set -euo pipefail

KAFKA_CONTAINER="${KAFKA_CONTAINER:-kafka}"
DLQ_TOPIC="${KAFKA_DLQ_TOPIC:-collabspace.dlq.events}"
MAX_MESSAGES="${1:-0}"
DRY_RUN="${DRY_RUN:-false}"

echo "==> Reading DLQ topic ${DLQ_TOPIC}"

consumer_cmd=(docker exec "$KAFKA_CONTAINER" /opt/kafka/bin/kafka-console-consumer.sh
  --bootstrap-server localhost:9092
  --topic "$DLQ_TOPIC"
  --from-beginning
  --timeout-ms 10000)
if [[ "$MAX_MESSAGES" != "0" && -n "$MAX_MESSAGES" ]]; then
  consumer_cmd+=(--max-messages "$MAX_MESSAGES")
fi

mapfile -t lines < <("${consumer_cmd[@]}" 2>/dev/null || true)
if [[ ${#lines[@]} -eq 0 ]]; then
  echo "No DLQ messages found."
  exit 0
fi

replayed=0
for line in "${lines[@]}"; do
  [[ -z "$line" ]] && continue
  source_topic=$(echo "$line" | jq -r '.sourceTopic')
  payload=$(echo "$line" | jq -c '.payload')
  offset=$(echo "$line" | jq -r '.offset')
  err=$(echo "$line" | jq -r '.errorMessage')
  echo "Replay sourceTopic=${source_topic} offset=${offset} error=${err}"

  if [[ "$DRY_RUN" == "true" ]]; then
    replayed=$((replayed + 1))
    continue
  fi

  echo "$payload" | docker exec -i "$KAFKA_CONTAINER" /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic "$source_topic"
  replayed=$((replayed + 1))
done

echo "Replayed ${replayed} message(s) from DLQ."
