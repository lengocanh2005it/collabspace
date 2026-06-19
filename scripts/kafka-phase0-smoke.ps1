# Phase 0 smoke test: Kafka broker + Debezium Connect REST + produce/consume.
$ErrorActionPreference = "Stop"

$ConnectUrl = if ($env:DEBEZIUM_CONNECT_URL_HOST) { $env:DEBEZIUM_CONNECT_URL_HOST } else { "http://localhost:8083" }
$KafkaContainer = if ($env:KAFKA_CONTAINER) { $env:KAFKA_CONTAINER } else { "kafka" }
$Topic = if ($env:KAFKA_SMOKE_TOPIC) { $env:KAFKA_SMOKE_TOPIC } else { "collabspace.test" }
$Message = if ($env:KAFKA_SMOKE_MESSAGE) { $env:KAFKA_SMOKE_MESSAGE } else { "collabspace-phase0-ok" }

Write-Host "==> Checking Debezium Connect at $ConnectUrl"
try {
  $null = Invoke-RestMethod -Uri "$ConnectUrl/connectors" -Method Get -TimeoutSec 10
} catch {
  Write-Error @"
FAIL: Debezium Connect not reachable at $ConnectUrl
Start: docker compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.db.yml -f infrastructure/docker/docker-compose.kafka.yml up -d kafka debezium-connect
"@
}
Write-Host "OK: Connect REST /connectors"

Write-Host "==> Checking Kafka container $KafkaContainer"
docker exec $KafkaContainer /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "FAIL: Kafka broker not healthy in container $KafkaContainer"
}
Write-Host "OK: Kafka broker"

Write-Host "==> Creating topic $Topic (if missing)"
docker exec $KafkaContainer /opt/kafka/bin/kafka-topics.sh `
  --bootstrap-server localhost:9092 `
  --create --if-not-exists `
  --topic $Topic `
  --partitions 1 `
  --replication-factor 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "FAIL: could not create topic $Topic" }

Write-Host "==> Producing test message"
$Message | docker exec -i $KafkaContainer /opt/kafka/bin/kafka-console-producer.sh `
  --bootstrap-server localhost:9092 `
  --topic $Topic
if ($LASTEXITCODE -ne 0) { throw "FAIL: produce failed" }

Write-Host "==> Consuming one message"
$Consumed = docker exec $KafkaContainer /opt/kafka/bin/kafka-console-consumer.sh `
  --bootstrap-server localhost:9092 `
  --topic $Topic `
  --from-beginning `
  --max-messages 1 `
  --timeout-ms 15000 2>$null | Select-Object -Last 1

if ($Consumed -ne $Message) {
  throw "FAIL: expected '$Message', got '$Consumed'"
}

Write-Host "OK: produce/consume verified"
Write-Host "Phase 0 smoke test passed."
