# Replay messages from Kafka DLQ topic

When consumers exhaust retries, failed messages land in **`collabspace.dlq.events`** with envelope schema `infrastructure/kafka/schemas/kafka-dlq-envelope.v1.json`.

## Prerequisites

- Kafka stack running (`docker compose ... docker-compose.kafka.yml`)
- Inspect DLQ on Kafka UI (`http://localhost:8088`, profile `kafka-ui`) or console consumer

## Dry-run (inspect only)

```powershell
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh `
  --bootstrap-server localhost:9092 `
  --topic collabspace.dlq.events `
  --from-beginning `
  --max-messages 10 `
  --timeout-ms 15000
```

## Replay to source topic

Script republishes `payload` from each DLQ envelope back to `sourceTopic` (does **not** delete DLQ messages — compact/reassign offsets manually if needed):

```powershell
.\scripts\kafka-replay-dlq.ps1
# Limit messages:
.\scripts\kafka-replay-dlq.ps1 -MaxMessages 5
# Dry run (print only):
.\scripts\kafka-replay-dlq.ps1 -DryRun
```

Linux:

```bash
./scripts/kafka-replay-dlq.sh
./scripts/kafka-replay-dlq.sh --max-messages 5 --dry-run
```

## After replay

1. Confirm consumer group processed the republished event (check app logs / notifications).
2. If duplicate side-effects occur, handlers must be idempotent (`eventId` keys) — see `.claude/docs/resilience.md`.
3. Optionally reset DLQ topic after successful replay (dev only):

```powershell
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --delete --topic collabspace.dlq.events
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic collabspace.dlq.events --partitions 1 --replication-factor 1
```

## Reset consumer offset (reprocess from beginning)

Use when testing a **new** consumer or debugging (dev only):

```powershell
.\scripts\kafka-reset-consumer-offset.ps1 -ConsumerGroup notification-service-workspace-events -Topic collabspace.workspace.workspace_invited -Offset earliest
```

See also: [KafkaDlqNotEmpty.md](../docs/runbooks/KafkaDlqNotEmpty.md), [KafkaConsumerLagHigh.md](../docs/runbooks/KafkaConsumerLagHigh.md).
