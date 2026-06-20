# Phase 0M DoD smoke: Mongo replica set rs0 + task/notification Mongo connectivity.
$ErrorActionPreference = "Stop"

$TaskUrl = if ($env:TASK_HEALTH_URL) { $env:TASK_HEALTH_URL } else { "http://localhost:3003/api/v1/tasks/health/ready" }
$NotifUrl = if ($env:NOTIF_HEALTH_URL) { $env:NOTIF_HEALTH_URL } else { "http://localhost:3004/api/v1/notifications/health/ready" }

Write-Host "==> Mongo replica set rs0"
& (Join-Path $PSScriptRoot "init-mongo-rs.ps1")

Write-Host "==> Mongo multi-document transaction (requires replica set)"
docker exec mongo mongosh -u admin -p password --authenticationDatabase admin --quiet --eval @"
const session = db.getMongo().startSession();
session.withTransaction(() => {
  session.getDatabase('collabspace_task').getCollection('_phase0m_txn_probe').insertOne(
    { probe: true, at: new Date() },
  );
});
print('OK: withTransaction');
"@ | Out-Null
if ($LASTEXITCODE -ne 0) { throw "FAIL: Mongo withTransaction" }
Write-Host "OK: withTransaction"

Write-Host "==> task-service readiness $TaskUrl"
try {
  $task = Invoke-WebRequest -Uri $TaskUrl -UseBasicParsing -TimeoutSec 30
  if ($task.StatusCode -ne 200) { throw "HTTP $($task.StatusCode)" }
} catch {
  throw "FAIL: task-service not ready at $TaskUrl — start full stack: .\scripts\docker-local-up.ps1 -Kafka"
}
Write-Host "OK: task-service ready"

Write-Host "==> notification-service readiness $NotifUrl"
try {
  $notif = Invoke-WebRequest -Uri $NotifUrl -UseBasicParsing -TimeoutSec 30
  if ($notif.StatusCode -ne 200) { throw "HTTP $($notif.StatusCode)" }
} catch {
  throw "FAIL: notification-service not ready at $NotifUrl"
}
Write-Host "OK: notification-service ready"

Write-Host ""
Write-Host "Phase 0M smoke PASSED (rs0 + transactions + Mongo-backed services healthy)"
