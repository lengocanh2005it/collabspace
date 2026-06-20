# Register (or update) Debezium user outbox connector — Phase 4a.
$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$ConnectUrl = if ($env:DEBEZIUM_CONNECT_URL_HOST) { $env:DEBEZIUM_CONNECT_URL_HOST } else { "http://localhost:8083" }
$ConnectorJsonPath = Join-Path $RootDir "infrastructure\kafka\connectors\user-outbox-connector.json"
$ConnectorName = "collabspace-user-outbox"

Write-Host "==> Debezium Connect: $ConnectUrl"
try {
  $null = Invoke-RestMethod -Uri "$ConnectUrl/connectors" -Method Get -TimeoutSec 15
} catch {
  throw "FAIL: Connect not reachable. Start kafka + debezium-connect first."
}

$connectorDoc = Get-Content -Raw -Path $ConnectorJsonPath | ConvertFrom-Json
$configBody = $connectorDoc.config | ConvertTo-Json -Compress -Depth 20

$exists = $false
try {
  $null = Invoke-RestMethod -Uri "$ConnectUrl/connectors/$ConnectorName" -Method Get -TimeoutSec 15
  $exists = $true
} catch {
  $exists = $false
}

if ($exists) {
  Write-Host "==> Updating existing connector $ConnectorName"
  Invoke-RestMethod -Uri "$ConnectUrl/connectors/$ConnectorName/config" -Method Put `
    -ContentType "application/json" -Body $configBody | Out-Null
} else {
  Write-Host "==> Creating connector $ConnectorName"
  $createBody = @{ name = $ConnectorName; config = $connectorDoc.config } | ConvertTo-Json -Compress -Depth 20
  Invoke-RestMethod -Uri "$ConnectUrl/connectors" -Method Post `
    -ContentType "application/json" -Body $createBody | Out-Null
}

Write-Host "==> Connector status"
$status = $null
for ($i = 0; $i -lt 12; $i++) {
  try {
    $status = Invoke-RestMethod -Uri "$ConnectUrl/connectors/$ConnectorName/status" -Method Get -TimeoutSec 15
    break
  } catch {
    Start-Sleep -Seconds 5
  }
}
if ($null -eq $status) {
  throw "FAIL: connector $ConnectorName status not available after create/update"
}
$status | ConvertTo-Json -Depth 6
Write-Host "Registered $ConnectorName."
