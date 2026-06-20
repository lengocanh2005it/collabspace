#!/usr/bin/env pwsh
# Replay DLQ envelopes from collabspace.dlq.events back to sourceTopic.
param(
  [string]$KafkaContainer = $(if ($env:KAFKA_CONTAINER) { $env:KAFKA_CONTAINER } else { "kafka" }),
  [string]$DlqTopic = $(if ($env:KAFKA_DLQ_TOPIC) { $env:KAFKA_DLQ_TOPIC } else { "collabspace.dlq.events" }),
  [int]$MaxMessages = 0,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "==> Reading DLQ topic $DlqTopic (max=$MaxMessages dryRun=$DryRun)"

$consumerArgs = @(
  "/opt/kafka/bin/kafka-console-consumer.sh",
  "--bootstrap-server", "localhost:9092",
  "--topic", $DlqTopic,
  "--from-beginning",
  "--timeout-ms", "10000"
)
if ($MaxMessages -gt 0) {
  $consumerArgs += @("--max-messages", "$MaxMessages")
}

$lines = docker exec $KafkaContainer @consumerArgs 2>$null
if (-not $lines) {
  Write-Host "No DLQ messages found."
  exit 0
}

$replayed = 0
foreach ($line in $lines) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  try {
    $envelope = $line | ConvertFrom-Json
  } catch {
    Write-Warning "Skip invalid JSON line: $line"
    continue
  }

  $sourceTopic = $envelope.sourceTopic
  $payloadJson = $envelope.payload | ConvertTo-Json -Compress -Depth 20
  Write-Host "Replay sourceTopic=$sourceTopic offset=$($envelope.offset) error=$($envelope.errorMessage)"

  if ($DryRun) {
    $replayed++
    continue
  }

  $payloadJson | docker exec -i $KafkaContainer /opt/kafka/bin/kafka-console-producer.sh `
    --bootstrap-server localhost:9092 `
    --topic $sourceTopic | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "FAIL: produce to $sourceTopic failed"
  }
  $replayed++
}

Write-Host "Replayed $replayed message(s) from DLQ."
