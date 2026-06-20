# Phase 5M E2E: task_assigned + comment_created + comment_mentioned via Kafka (Debezium Mongo CDC)
$ErrorActionPreference = "Stop"

$Auth = "http://localhost:3000/api/v1/auth"
$Workspace = "http://localhost:3002/api/v1"
$Task = "http://localhost:3003/api/v1"
$Notification = "http://localhost:3004/api/v1/notifications"

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

function Get-NotificationItems($body) {
  if ($null -eq $body) { return @() }
  if ($body.notifications) { return @($body.notifications) }
  if ($body.items) { return @($body.items) }
  if ($body.data) { return @($body.data) }
  if ($body -is [System.Array]) { return @($body) }
  return @($body)
}

function Assert2xx($r, $ctx) {
  if ($r.Code -lt 200 -or $r.Code -ge 300) {
    throw "$ctx failed HTTP $($r.Code): $($r.Body | ConvertTo-Json -Compress -Depth 5)"
  }
}

function Wait-NotificationType {
  param(
    [string]$Token,
    [string]$TypePattern,
    [string]$Label,
    [int]$Seconds = 40
  )
  for ($i = 0; $i -lt ($Seconds / 2); $i++) {
    Start-Sleep -Seconds 2
    $r = Invoke-Api GET $Notification -Headers @{ Authorization = "Bearer $Token" }
    Assert2xx $r "list notifications"
    $items = Get-NotificationItems $r.Body
    $match = $items | Where-Object {
      ($_.type -match $TypePattern) -or ($_.notificationType -match $TypePattern)
    }
    if ($match) {
      Write-Host "OK: $Label"
      return
    }
  }
  throw "FAIL: $Label not found after ${Seconds}s"
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$emailA = "kafka-p5a-$ts@example.com"
$emailB = "kafka-p5b-$ts@example.com"
$pass = "Demo@12345"

Write-Host "==> Register + verify User A ($emailA)"
$r = Invoke-Api POST "$Auth/register" -Body @{ email = $emailA; password = $pass; fullName = "Kafka P5 Alice" }
Assert2xx $r "register A"
$userAId = $r.Body.userId
$otpA = $r.Body.otp
if (-not $otpA) { $otpA = Get-DevOtp $emailA }
$r = Invoke-Api POST "$Auth/verify-email" -Body @{ otp = "$otpA"; userId = "$userAId" }
Assert2xx $r "verify A"
$r = Invoke-Api POST "$Auth/login" -Body @{ email = $emailA; password = $pass }
Assert2xx $r "login A"
$tokenA = $r.Body.accessToken

Write-Host "==> Register + verify User B ($emailB)"
$r = Invoke-Api POST "$Auth/register" -Body @{ email = $emailB; password = $pass; fullName = "Kafka P5 Bob" }
Assert2xx $r "register B"
$userBId = $r.Body.userId
$otpB = $r.Body.otp
if (-not $otpB) { $otpB = Get-DevOtp $emailB }
$r = Invoke-Api POST "$Auth/verify-email" -Body @{ otp = "$otpB"; userId = "$userBId" }
Assert2xx $r "verify B"
$r = Invoke-Api POST "$Auth/login" -Body @{ email = $emailB; password = $pass }
Assert2xx $r "login B"
$tokenB = $r.Body.accessToken

Write-Host "==> Set username for mention (@kafka_p5_b_$ts)"
$usernameB = "kafka_p5_b_$ts"
$r = Invoke-Api PATCH "http://localhost:3001/api/v1/users/me" -Headers @{ Authorization = "Bearer $tokenB" } -Body @{
  username = $usernameB
  displayName = "Bob P5"
}
Assert2xx $r "update profile B"

Write-Host "==> Wait for user replicas sync (Kafka)"
Start-Sleep -Seconds 6

Write-Host "==> Create workspace + invite User B"
$r = Invoke-Api POST "$Workspace/workspaces" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{
  name = "Kafka Phase5 $ts"; description = "e2e"
}
Assert2xx $r "create workspace"
$workspaceId = $r.Body.id
$r = Invoke-Api POST "$Workspace/workspaces/$workspaceId/invite" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{ email = $emailB }
Assert2xx $r "invite B"
$invitationId = $r.Body.id ?? $r.Body.invitationId
$r = Invoke-Api POST "$Workspace/invitations/$invitationId/accept" -Headers @{ Authorization = "Bearer $tokenB" } -Body @{}
Assert2xx $r "accept invite"

Write-Host "==> Create project + task"
$r = Invoke-Api POST "$Workspace/workspaces/$workspaceId/projects" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{ name = "P1" }
Assert2xx $r "create project"
$projectId = $r.Body.id
$r = Invoke-Api POST "$Task/tasks" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{
  title = "Kafka P5 task $ts"; workspaceId = $workspaceId; projectId = $projectId
}
Assert2xx $r "create task"
$taskId = $r.Body.id ?? $r.Body.data.id

Write-Host "==> User A comments with @mention on unassigned task (Kafka comment_mentioned)"
$r = Invoke-Api POST "$Task/tasks/$taskId/comments" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{
  content = "Hello @$usernameB please review"
}
Assert2xx $r "create comment with mention"
Wait-NotificationType -Token $tokenB -TypePattern "COMMENT_MENTIONED" -Label "comment_mentioned notification for User B"

Write-Host "==> Assign task to User B (Kafka task_assigned)"
$r = Invoke-Api PATCH "$Task/tasks/$taskId/assignee" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{ assigneeId = $userBId }
Assert2xx $r "assign task"
Wait-NotificationType -Token $tokenB -TypePattern "TASK_ASSIGNED" -Label "task_assigned notification for User B"

Write-Host "==> User A comments again (Kafka comment_created for assignee)"
$r = Invoke-Api POST "$Task/tasks/$taskId/comments" -Headers @{ Authorization = "Bearer $tokenA" } -Body @{
  content = "Follow-up after assign"
}
Assert2xx $r "create follow-up comment"
Wait-NotificationType -Token $tokenB -TypePattern "COMMENT_ADDED" -Label "task_commented notification for assignee User B"

Write-Host ""
Write-Host "Phase 5M E2E passed (mention + assign + comment via Kafka)."
