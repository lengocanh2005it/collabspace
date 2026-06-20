# Phase 1 smoke: insert workspace outbox row -> Debezium -> Kafka topic.
$ErrorActionPreference = "Stop"

$EventId = [guid]::NewGuid().ToString()
$WorkspaceId = [guid]::NewGuid().ToString()
$InvitationId = [guid]::NewGuid().ToString()
$Topic = "collabspace.workspace.workspace_invited"
$PayloadJson = (@{
  eventId = $EventId
  occurredAt = (Get-Date).ToUniversalTime().ToString("o")
  invitationId = $InvitationId
  workspaceId = $WorkspaceId
  workspaceName = "Phase1 Smoke Workspace"
  invitedById = [guid]::NewGuid().ToString()
  inviteEmail = "phase1-smoke@example.com"
} | ConvertTo-Json -Compress)

Write-Host "==> Insert outbox row (workspaceId=$WorkspaceId)"
$Sql = @"
INSERT INTO workspace_outbox_events (
  id, event_type, payload, aggregate_type, aggregate_id,
  attempt_count, available_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'workspace.workspace_invited',
  '$PayloadJson'::jsonb,
  'Workspace',
  '$WorkspaceId'::uuid,
  0,
  NOW(),
  NOW(),
  NOW()
);
"@

docker exec postgres psql -U postgres -d collabspace_workspace -v ON_ERROR_STOP=1 -c $Sql | Out-Null

Write-Host "==> Waiting for Kafka message on $Topic (eventId=$EventId)"
$deadline = (Get-Date).AddSeconds(45)
$found = $false

while ((Get-Date) -lt $deadline) {
  $output = docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh `
    --bootstrap-server localhost:9092 `
    --topic $Topic `
    --from-beginning `
    --timeout-ms 5000 `
    --property print.key=true 2>$null

  if ($output -match $EventId) {
    $found = $true
    Write-Host "OK: found event in Kafka topic"
    Write-Host $output
    break
  }

  Start-Sleep -Seconds 3
}

if (-not $found) {
  throw "FAIL: eventId $EventId not seen on topic $Topic within 45s. Check connector status and postgres wal_level=logical."
}

Write-Host "Phase 1 smoke test passed."
