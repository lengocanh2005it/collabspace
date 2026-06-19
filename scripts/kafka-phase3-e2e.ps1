# Phase 3 E2E: workspace invite + delete via Kafka (Debezium CDC, no RMQ for workspace events)
$ErrorActionPreference = "Stop"

$Auth = "http://localhost:3000/api/v1/auth"
$Workspace = "http://localhost:3002/api/v1"
$Task = "http://localhost:3003/api/v1"
$Notification = "http://localhost:3004/api/v1/notifications"
$User = "http://localhost:3001/api/v1/users"

function Invoke-Api {
  param([string]$Method, [string]$Url, [hashtable]$Headers = @{}, [object]$Body = $null)
  $params = @{ Method = $Method; Uri = $Url; Headers = @{ "Content-Type" = "application/json" } + $Headers }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
  try {
    $resp = Invoke-WebRequest @params -UseBasicParsing
    [PSCustomObject]@{ Code = [int]$resp.StatusCode; Body = ($resp.Content | ConvertFrom-Json -ErrorAction SilentlyContinue) }
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    $raw = $_.ErrorDetails.Message
    [PSCustomObject]@{ Code = $code; Body = ($raw | ConvertFrom-Json -ErrorAction SilentlyContinue) ?? $raw }
  }
}

function Get-DevOtp([string]$Email) {
  $escaped = $Email.Replace("'", "''")
  $sql = "SELECT payload->>'otp' FROM auth_outbox_events WHERE payload->>'email' = '$escaped' ORDER BY created_at DESC LIMIT 1;"
  $otp = (docker exec postgres psql -U postgres -d collabspace_auth -tAc $sql 2>$null).Trim()
  if ($otp) { return $otp }
  try {
    $dev = Invoke-Api GET "$Auth/dev/otp?email=$([uri]::EscapeDataString($Email))"
    if ($dev.Code -eq 200) { return $dev.Body.otp }
  } catch { }
  return $null
}

function Assert2xx($r, $ctx) {
  if ($r.Code -lt 200 -or $r.Code -ge 300) {
    throw "$ctx failed HTTP $($r.Code): $($r.Body | ConvertTo-Json -Compress -Depth 5)"
  }
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$emailA = "kafka-a-$ts@example.com"
$emailB = "kafka-b-$ts@example.com"
$pass = "Demo@12345"

Write-Host "==> Register + verify User A ($emailA)"
$r = Invoke-Api POST "$Auth/register" -Body @{ email = $emailA; password = $pass; fullName = "Kafka Alice" }
Assert2xx $r "register A"
$userAId = $r.Body.userId
$otpA = $r.Body.otp
if (-not $otpA) { $otpA = Get-DevOtp $emailA }
if (-not $userAId -or -not $otpA) { throw "Missing userId or otp for User A" }
$r = Invoke-Api POST "$Auth/verify-email" -Body @{ otp = "$otpA"; userId = "$userAId" }
Assert2xx $r "verify A"
$r = Invoke-Api POST "$Auth/login" -Body @{ email = $emailA; password = $pass }
Assert2xx $r "login A"
$tokenA = $r.Body.accessToken

Write-Host "==> Register + verify User B ($emailB)"
$r = Invoke-Api POST "$Auth/register" -Body @{ email = $emailB; password = $pass; fullName = "Kafka Bob" }
Assert2xx $r "register B"
$userBId = $r.Body.userId
$otpB = $r.Body.otp
if (-not $otpB) { $otpB = Get-DevOtp $emailB }
if (-not $userBId -or -not $otpB) { throw "Missing userId or otp for User B" }
$r = Invoke-Api POST "$Auth/verify-email" -Body @{ otp = "$otpB"; userId = "$userBId" }
Assert2xx $r "verify B"
$r = Invoke-Api POST "$Auth/login" -Body @{ email = $emailB; password = $pass }
Assert2xx $r "login B"
$tokenB = $r.Body.accessToken

$r = Invoke-Api GET "$User/me" -Headers @{ Authorization = "Bearer $tokenB" }
Assert2xx $r "user B profile"
if (-not $userBId) { $userBId = $r.Body.userId ?? $r.Body.id }

Write-Host "==> Create workspace + invite User B"
$r = Invoke-Api POST "$Workspace/workspaces" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{
  name = "Kafka Phase3 $ts"; description = "e2e"
}
Assert2xx $r "create workspace"
$workspaceId = $r.Body.id
$r = Invoke-Api POST "$Workspace/workspaces/$workspaceId/invite" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{ email = $emailB }
Assert2xx $r "invite B"
$invitationId = $r.Body.id ?? $r.Body.invitationId

Write-Host "==> User B accepts invite"
$r = Invoke-Api POST "$Workspace/invitations/$invitationId/accept" -Headers @{ Authorization = "Bearer $tokenB" } -Body @{}
Assert2xx $r "accept invite"

Write-Host "==> Wait for workspace_invited notification (Kafka)"
$inviteFound = $false
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 2
  $r = Invoke-Api GET $Notification -Headers @{ Authorization = "Bearer $tokenB" }
  Assert2xx $r "list notifications B"
  $items = @($r.Body)
  if ($r.Body.data) { $items = @($r.Body.data) }
  if ($r.Body.items) { $items = @($r.Body.items) }
  $match = $items | Where-Object { $_.type -match "WORKSPACE_INVITED" -or $_.notificationType -match "WORKSPACE_INVITED" }
  if ($match) { $inviteFound = $true; break }
}
if (-not $inviteFound) { throw "FAIL: no WORKSPACE_INVITED notification for User B after 30s" }
Write-Host "OK: workspace_invited notification received"

Write-Host "==> Create project + task"
$r = Invoke-Api POST "$Workspace/workspaces/$workspaceId/projects" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{ name = "P1" }
Assert2xx $r "create project"
$projectId = $r.Body.id
$r = Invoke-Api POST "$Task/tasks" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{
  title = "Kafka task $ts"; workspaceId = $workspaceId; projectId = $projectId
}
Assert2xx $r "create task"
$taskId = $r.Body.id ?? $r.Body.data.id

Write-Host "==> Delete workspace"
$r = Invoke-Api -Method DELETE -Url "$Workspace/workspaces/$workspaceId" -Headers @{ Authorization = "Bearer $tokenA" }
if ($r.Code -ne 204 -and ($r.Code -lt 200 -or $r.Code -ge 300)) {
  throw "delete workspace failed HTTP $($r.Code)"
}

Write-Host "==> Wait for task cleanup (workspace_deleted via Kafka)"
$taskGone = $false
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 2
  $r = Invoke-Api GET "$Task/tasks/$taskId" -Headers @{ Authorization = "Bearer $tokenA" }
  if ($r.Code -eq 404) { $taskGone = $true; break }
}
if (-not $taskGone) { throw "FAIL: task $taskId still exists after workspace delete" }
Write-Host "OK: task cleaned up after workspace_deleted"

Write-Host ""
Write-Host "Phase 3 E2E passed (invite notification + delete task cleanup via Kafka)."
