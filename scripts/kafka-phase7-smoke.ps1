# Phase 7 smoke: DLQ topic, kafka-exporter metrics, optional Schema Registry.
$ErrorActionPreference = "Stop"

$KafkaContainer = if ($env:KAFKA_CONTAINER) { $env:KAFKA_CONTAINER } else { "kafka" }
$DlqTopic = if ($env:KAFKA_DLQ_TOPIC) { $env:KAFKA_DLQ_TOPIC } else { "collabspace.dlq.events" }
$ExporterUrl = if ($env:KAFKA_EXPORTER_URL) { $env:KAFKA_EXPORTER_URL } else { "http://localhost:9308/metrics" }

Write-Host "==> Ensure DLQ topic exists: $DlqTopic"
docker exec $KafkaContainer /opt/kafka/bin/kafka-topics.sh `
  --bootstrap-server localhost:9092 `
  --create --if-not-exists `
  --topic $DlqTopic `
  --partitions 1 `
  --replication-factor 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "FAIL: could not create DLQ topic" }
Write-Host "OK: DLQ topic"

Write-Host "==> Checking kafka-exporter at $ExporterUrl"
try {
  $metrics = Invoke-WebRequest -Uri $ExporterUrl -UseBasicParsing -TimeoutSec 10
  if ($metrics.Content -notmatch "kafka_consumergroup_(lag|current_offset)") {
    throw "kafka_consumergroup lag/offset metrics not found"
  }
} catch {
  Write-Error @"
FAIL: kafka-exporter not reachable or missing lag metrics at $ExporterUrl
Start: docker compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.db.yml -f infrastructure/docker/docker-compose.kafka.yml up -d kafka kafka-exporter
"@
}
Write-Host "OK: kafka-exporter lag metrics"

Write-Host "==> Optional Schema Registry (profile schema-registry)"
$SchemaUrl = if ($env:SCHEMA_REGISTRY_URL) { $env:SCHEMA_REGISTRY_URL } else { "http://localhost:8081/subjects" }
try {
  $null = Invoke-RestMethod -Uri $SchemaUrl -Method Get -TimeoutSec 3
  Write-Host "OK: Schema Registry reachable at $SchemaUrl"
} catch {
  Write-Host "SKIP: Schema Registry not running (optional — enable profile schema-registry)"
}

Write-Host "Phase 7 smoke test passed."
