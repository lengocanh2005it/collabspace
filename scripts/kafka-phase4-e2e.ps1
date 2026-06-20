# Phase 4 E2E: user_registered + user_profile_updated via Kafka (Debezium CDC)
$ErrorActionPreference = "Stop"

$Auth = "http://localhost:3000/api/v1/auth"
$User = "http://localhost:3001/api/v1/users"
$TaskDb = "collabspace_task"
$ReplicaCollection = "user_replicas"

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

function Get-TaskUserReplica([string]$UserId) {
  $js = "JSON.stringify(db.getCollection('$ReplicaCollection').findOne({ userId: '$UserId' }))"
  $raw = docker exec mongo mongosh -u admin -p password --authenticationDatabase admin $TaskDb --quiet --eval $js 2>$null
  if (-not $raw -or $raw -eq "null") { return $null }
  return $raw | ConvertFrom-Json
}

function Wait-TaskUserReplica {
  param([string]$UserId, [scriptblock]$Predicate, [string]$Label, [int]$Seconds = 30)
  for ($i = 0; $i -lt ($Seconds / 2); $i++) {
    Start-Sleep -Seconds 2
    $doc = Get-TaskUserReplica $UserId
    if ($null -ne $doc -and (& $Predicate $doc)) {
      Write-Host "OK: $Label"
      return $doc
    }
  }
  throw "FAIL: $Label not satisfied after ${Seconds}s (userId=$UserId)"
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "kafka-p4-$ts@example.com"
$pass = "Demo@12345"
$newDisplay = "Kafka P4 Display $ts"

Write-Host "==> Register + verify user ($email)"
$r = Invoke-Api POST "$Auth/register" -Body @{ email = $email; password = $pass; fullName = "Kafka Phase4 User" }
Assert2xx $r "register"
$userId = $r.Body.userId
$otp = $r.Body.otp
if (-not $otp) { $otp = Get-DevOtp $email }
if (-not $userId -or -not $otp) { throw "Missing userId or otp" }
$r = Invoke-Api POST "$Auth/verify-email" -Body @{ otp = "$otp"; userId = "$userId" }
Assert2xx $r "verify"
$r = Invoke-Api POST "$Auth/login" -Body @{ email = $email; password = $pass }
Assert2xx $r "login"
$token = $r.Body.accessToken

Write-Host "==> Wait for user_registered → task user_replicas (Kafka)"
Wait-TaskUserReplica -UserId $userId -Label "user_registered replica in task-service" -Predicate {
  param($doc) $doc.email -eq $email
}

Write-Host "==> PATCH profile (user_profile_updated via outbox)"
$r = Invoke-Api PATCH "$User/me" -Headers @{ Authorization = "Bearer $token" } -Body @{
  displayName = $newDisplay
}
Assert2xx $r "patch profile"

Write-Host "==> Wait for user_profile_updated → task replica displayName"
Wait-TaskUserReplica -UserId $userId -Label "user_profile_updated replica sync" -Predicate {
  param($doc) $doc.displayName -eq $newDisplay
}

$r = Invoke-Api GET "$User/me" -Headers @{ Authorization = "Bearer $token" }
Assert2xx $r "get me"
if ($r.Body.displayName -ne $newDisplay) {
  throw "FAIL: user-service profile displayName=$($r.Body.displayName) expected $newDisplay"
}
Write-Host "OK: user-service profile updated"

Write-Host ""
Write-Host "Phase 4 E2E passed (user_registered + user_profile_updated via Kafka → task replica)."
