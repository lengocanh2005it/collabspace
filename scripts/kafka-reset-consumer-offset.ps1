#!/usr/bin/env pwsh
# Reset a Kafka consumer group offset (dev replay / debug only).
param(
  [Parameter(Mandatory = $true)]
  [string]$ConsumerGroup,
  [Parameter(Mandatory = $true)]
  [string]$Topic,
  [ValidateSet("earliest", "latest")]
  [string]$Offset = "earliest",
  [string]$KafkaContainer = $(if ($env:KAFKA_CONTAINER) { $env:KAFKA_CONTAINER } else { "kafka" })
)

$ErrorActionPreference = "Stop"

Write-Host "==> Resetting group=$ConsumerGroup topic=$Topic to $Offset"

docker exec $KafkaContainer /opt/kafka/bin/kafka-consumer-groups.sh `
  --bootstrap-server localhost:9092 `
  --group $ConsumerGroup `
  --topic $Topic `
  --reset-offsets `
  --to-$Offset `
  --execute | Out-Host

if ($LASTEXITCODE -ne 0) {
  throw "FAIL: offset reset failed (is the consumer stopped?)"
}

Write-Host "OK: offset reset. Restart the consumer service to reprocess."
