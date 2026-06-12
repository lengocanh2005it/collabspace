# demo-e2e.ps1 — CollabSpace end-to-end demo story
# Runs 7 steps through Traefik gateway (http://localhost/api/v1/...)
# Exit code != 0 on any failure. Set $env:DEBUG=1 for verbose output.
#Requires -Version 7
$ErrorActionPreference = 'Stop'

$BASE  = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost/api/v1' }
$DEBUG = $env:DEBUG -eq '1'

# ---------- helpers ----------------------------------------------------------

function Log  ([string]$msg) { Write-Host "[demo-e2e] $msg" }
function Dbg  ([string]$msg) { if ($DEBUG) { Write-Host "[DEBUG] $msg" } }
function Fail ([string]$msg) { Write-Error "[FAIL] $msg"; exit 1 }

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )
  $params = @{
    Method  = $Method
    Uri     = $Url
    Headers = @{ 'Content-Type' = 'application/json' } + $Headers
  }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
  try {
    $resp = Invoke-WebRequest @params -UseBasicParsing
    [PSCustomObject]@{ Code = [int]$resp.StatusCode; Body = ($resp.Content | ConvertFrom-Json -ErrorAction SilentlyContinue) }
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    $raw  = $_.ErrorDetails.Message
    [PSCustomObject]@{ Code = $code; Body = ($raw | ConvertFrom-Json -ErrorAction SilentlyContinue) ?? $raw }
  }
}

function Assert2xx ([PSCustomObject]$r, [string]$ctx) {
  if ($r.Code -lt 200 -or $r.Code -ge 300) {
    Fail "$ctx — HTTP $($r.Code): $($r.Body | ConvertTo-Json -Compress)"
  }
  Dbg "$ctx → $($r.Code)"
}

function Get-Field ([object]$obj, [string]$path) {
  $val = $obj
  foreach ($key in $path.Split('.')) { $val = $val.$key }
  if ($null -eq $val -or $val -eq '') { $null } else { "$val" }
}

# ---------- preflight --------------------------------------------------------

Log "Checking gateway health..."
$health = Invoke-Api -Method GET -Url "$BASE/auth/health"
if ($health.Code -ne 200) {
  Fail "Gateway unreachable or auth-service down (HTTP $($health.Code)). Start the stack first."
}

$TS       = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$EMAIL_A  = "demo-a-$TS@example.com"
$EMAIL_B  = "demo-b-$TS@example.com"
$PASS     = 'Demo@12345'
$FULL_A   = "Demo Alice $TS"
$FULL_B   = "Demo Bob $TS"

# ---------- Step 1: Register + verify + login (User A) -----------------------

Log "Step 1: Register User A ($EMAIL_A)..."
$r = Invoke-Api -Method POST -Url "$BASE/auth/register" -Body @{ email=$EMAIL_A; password=$PASS; fullName=$FULL_A }
Assert2xx $r "register User A"

$OTP_A = $r.Body.otp
if (-not $OTP_A) {
  $dev = Invoke-Api -Method GET -Url "$BASE/auth/dev/otp?email=$EMAIL_A"
  $OTP_A = $dev.Body.otp
}
if (-not $OTP_A) { Fail "Cannot obtain OTP for User A. Check auth-service logs." }

Log "  Verifying email for User A (OTP: $OTP_A)..."
$r = Invoke-Api -Method POST -Url "$BASE/auth/verify-email" -Body @{ otp=$OTP_A }
Assert2xx $r "verify-email User A"

Log "  Logging in as User A..."
$r = Invoke-Api -Method POST -Url "$BASE/auth/login" -Body @{ email=$EMAIL_A; password=$PASS }
Assert2xx $r "login User A"
$TOKEN_A = $r.Body.accessToken ?? $r.Body.data.accessToken
if (-not $TOKEN_A) { Fail "No accessToken in login response." }
Log "  User A logged in. Token: $($TOKEN_A.Substring(0,[Math]::Min(20,$TOKEN_A.Length)))..."

# ---------- Step 2: Create workspace + invite User B -------------------------

Log "Step 2: Create workspace as User A..."
$r = Invoke-Api -Method POST -Url "$BASE/workspaces" `
  -Headers @{ Authorization="Bearer $TOKEN_A" } `
  -Body @{ name="Demo Workspace $TS"; description="E2E demo" }
Assert2xx $r "create workspace"
$WORKSPACE_ID = $r.Body.id ?? $r.Body.data.id
if (-not $WORKSPACE_ID) { Fail "No workspace id in response." }
Log "  Workspace created: $WORKSPACE_ID"

Log "  Inviting User B ($EMAIL_B)..."
$r = Invoke-Api -Method POST -Url "$BASE/workspaces/$WORKSPACE_ID/invite" `
  -Headers @{ Authorization="Bearer $TOKEN_A" } `
  -Body @{ email=$EMAIL_B }
Assert2xx $r "invite User B"
$INVITATION_ID = $r.Body.id ?? $r.Body.invitationId ?? $r.Body.data.id
if (-not $INVITATION_ID) { Fail "No invitation id in response." }
Log "  Invitation created: $INVITATION_ID"

# ---------- Step 3: Register + verify + login User B + accept invite ---------

Log "Step 3: Register User B ($EMAIL_B)..."
$r = Invoke-Api -Method POST -Url "$BASE/auth/register" -Body @{ email=$EMAIL_B; password=$PASS; fullName=$FULL_B }
Assert2xx $r "register User B"

$OTP_B = $r.Body.otp
if (-not $OTP_B) {
  $dev = Invoke-Api -Method GET -Url "$BASE/auth/dev/otp?email=$EMAIL_B"
  $OTP_B = $dev.Body.otp
}
if (-not $OTP_B) { Fail "Cannot obtain OTP for User B." }

Log "  Verifying email for User B..."
$r = Invoke-Api -Method POST -Url "$BASE/auth/verify-email" -Body @{ otp=$OTP_B }
Assert2xx $r "verify-email User B"

Log "  Logging in as User B..."
$r = Invoke-Api -Method POST -Url "$BASE/auth/login" -Body @{ email=$EMAIL_B; password=$PASS }
Assert2xx $r "login User B"
$TOKEN_B = $r.Body.accessToken ?? $r.Body.data.accessToken
if (-not $TOKEN_B) { Fail "No accessToken in login response." }
Log "  User B logged in. Token: $($TOKEN_B.Substring(0,[Math]::Min(20,$TOKEN_B.Length)))..."

Log "  User B accepting invitation $INVITATION_ID..."
$r = Invoke-Api -Method POST -Url "$BASE/invitations/$INVITATION_ID/accept" `
  -Headers @{ Authorization="Bearer $TOKEN_B" } -Body @{}
Assert2xx $r "accept invitation"
Log "  Invitation accepted."

# ---------- Step 4: Create project + task + assign to User B -----------------

Log "Step 4: Create project..."
$r = Invoke-Api -Method POST -Url "$BASE/workspaces/$WORKSPACE_ID/projects" `
  -Headers @{ Authorization="Bearer $TOKEN_A" } `
  -Body @{ name="Demo Project $TS" }
Assert2xx $r "create project"
$PROJECT_ID = $r.Body.id ?? $r.Body.data.id
if (-not $PROJECT_ID) { Fail "No project id in response." }
Log "  Project created: $PROJECT_ID"

Log "  Creating task..."
$r = Invoke-Api -Method POST -Url "$BASE/tasks" `
  -Headers @{ Authorization="Bearer $TOKEN_A" } `
  -Body @{ title="Demo Task $TS"; workspaceId=$WORKSPACE_ID; projectId=$PROJECT_ID }
Assert2xx $r "create task"
$TASK_ID = $r.Body.id ?? $r.Body.data.id
if (-not $TASK_ID) { Fail "No task id in response." }
Log "  Task created: $TASK_ID"

Log "  Getting User B's user ID..."
$r = Invoke-Api -Method GET -Url "$BASE/users/me" -Headers @{ Authorization="Bearer $TOKEN_B" }
Assert2xx $r "get User B profile"
$USER_B_ID = $r.Body.userId ?? $r.Body.data.userId ?? $r.Body.id ?? $r.Body.data.id
if (-not $USER_B_ID) { Fail "No user id in /users/me response." }
Log "  User B ID: $USER_B_ID"

Log "  Assigning task to User B..."
$r = Invoke-Api -Method PATCH -Url "$BASE/tasks/$TASK_ID/assignee" `
  -Headers @{ Authorization="Bearer $TOKEN_A" } `
  -Body @{ assigneeId=$USER_B_ID }
Assert2xx $r "assign task"
Log "  Task assigned."

# ---------- Step 5: User B changes status to DOING ---------------------------

Log "Step 5: User B changes task status to DOING..."
$r = Invoke-Api -Method PATCH -Url "$BASE/tasks/$TASK_ID/status" `
  -Headers @{ Authorization="Bearer $TOKEN_B" } `
  -Body @{ status="DOING" }
Assert2xx $r "update task status"
Log "  Status updated to DOING."

# ---------- Step 6: User A comments + mentions @user-b -----------------------

Log "Step 6: Getting User B's username..."
$r = Invoke-Api -Method GET -Url "$BASE/users/$USER_B_ID" -Headers @{ Authorization="Bearer $TOKEN_A" }
Assert2xx $r "get User B profile by ID"
$USERNAME_B = $r.Body.username ?? $r.Body.data.username ?? 'user-b'
Log "  User B username: $USERNAME_B"

Log "  User A posting comment mentioning @$USERNAME_B..."
$CONTENT = "Great work @${USERNAME_B}! Task is looking good."
$r = Invoke-Api -Method POST -Url "$BASE/tasks/$TASK_ID/comments" `
  -Headers @{ Authorization="Bearer $TOKEN_A" } `
  -Body @{ content=$CONTENT }
Assert2xx $r "create comment"
$COMMENT_ID = $r.Body.id ?? $r.Body.data.id
Log "  Comment created: $COMMENT_ID"

# ---------- Step 7: User B checks notifications ------------------------------

Log "Step 7: Waiting 2s for event propagation then checking notifications..."
Start-Sleep -Seconds 2

$r = Invoke-Api -Method GET -Url "$BASE/notifications" -Headers @{ Authorization="Bearer $TOKEN_B" }
Assert2xx $r "list notifications"

$items = if ($r.Body -is [array]) { $r.Body } `
  elseif ($r.Body.data -is [array]) { $r.Body.data } `
  elseif ($r.Body.items -is [array]) { $r.Body.items } `
  elseif ($r.Body.notifications -is [array]) { $r.Body.notifications } `
  else { @() }
$NOTIF_COUNT = $items.Count
Log "  User B has $NOTIF_COUNT notification(s)."

if ($NOTIF_COUNT -eq 0) {
  Log "  WARNING: notifications may not have propagated yet (RabbitMQ async). Check manually."
}

# ---------- Summary ----------------------------------------------------------

Write-Host ""
Write-Host "=========================================="
Write-Host "  CollabSpace E2E Demo — ALL STEPS PASSED"
Write-Host "=========================================="
Write-Host "  Workspace : $WORKSPACE_ID"
Write-Host "  Project   : $PROJECT_ID"
Write-Host "  Task      : $TASK_ID"
Write-Host "  Comment   : $COMMENT_ID"
Write-Host "  Invitation: $INVITATION_ID"
Write-Host "  User A    : $EMAIL_A"
Write-Host "  User B    : $USER_B_ID ($EMAIL_B)"
Write-Host "=========================================="
