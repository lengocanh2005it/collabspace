# feature-verify.ps1 — smoke test features from docs/features.md
#Requires -Version 7
$ErrorActionPreference = 'Stop'
$BASE = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost/api/v1' }
$PASS = 'collabspace123'
$results = [System.Collections.Generic.List[object]]::new()

function Record([string]$Area, [string]$Feature, [bool]$Ok, [string]$Detail = '') {
  $results.Add([PSCustomObject]@{ Area = $Area; Feature = $Feature; Status = $(if ($Ok) { 'OK' } else { 'FAIL' }); Detail = $Detail })
  $icon = if ($Ok) { '✓' } else { '✗' }
  Write-Host "$icon [$Area] $Feature $(if ($Detail) { "— $Detail" })"
}

function Api {
  param([string]$Method, [string]$Path, [hashtable]$Headers = @{}, [object]$Body = $null)
  $params = @{ Method = $Method; Uri = "$BASE$Path"; Headers = @{ 'Content-Type' = 'application/json' } + $Headers }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
  try {
    $resp = Invoke-WebRequest @params -UseBasicParsing
    return [PSCustomObject]@{ Ok = $true; Code = [int]$resp.StatusCode; Body = ($resp.Content | ConvertFrom-Json -ErrorAction SilentlyContinue); Raw = $resp.Content }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    $raw = $_.ErrorDetails.Message
    return [PSCustomObject]@{ Ok = $false; Code = $code; Body = ($raw | ConvertFrom-Json -ErrorAction SilentlyContinue); Raw = $raw }
  }
}

function Login([string]$Email) {
  $r = Api POST '/auth/login' -Body @{ email = $Email; password = $PASS }
  if (-not $r.Ok) { return $null }
  return $r.Body.accessToken ?? $r.Body.data.accessToken
}

Write-Host "=== CollabSpace Feature Verify ===" 
Write-Host "BASE: $BASE`n"

# ── Health / platform ─────────────────────────────────────────────────────────
foreach ($p in @('/auth/health/ready','/users/health/ready','/workspaces/health/ready','/tasks/health/ready','/notifications/health/ready')) {
  $r = Api GET $p
  Record 'Platform' "Health $p" ($r.Ok -and $r.Code -eq 200) "HTTP $($r.Code)"
}

# ── Auth (seed users) ─────────────────────────────────────────────────────────
$tokenA = Login 'ngocanh@collabspace.dev'
$tokenB = Login 'quangtien@collabspace.dev'
$tokenAdmin = Login 'tho@collabspace.dev'
Record 'Auth' 'Login (seed User A)' ($null -ne $tokenA)
Record 'Auth' 'Login (seed User B)' ($null -ne $tokenB)
Record 'Auth' 'Login (admin)' ($null -ne $tokenAdmin)

$hA = @{ Authorization = "Bearer $tokenA" }
$hB = @{ Authorization = "Bearer $tokenB" }

$r = Api GET '/auth/me' -Headers $hA
Record 'Auth' 'GET /auth/me' ($r.Ok) $(if (-not $r.Ok) { "HTTP $($r.Code)" })

$r = Api GET '/auth/verify' -Headers $hA
Record 'Auth' 'GET /auth/verify' ($r.Ok) $(if (-not $r.Ok) { "HTTP $($r.Code)" })

$r = Api GET '/auth/sessions' -Headers $hA
Record 'Auth' 'List sessions' ($r.Ok)

$loginResp = Api POST '/auth/login' -Body @{ email = 'ngocanh@collabspace.dev'; password = $PASS }
$refresh = $loginResp.Body.refreshToken ?? $loginResp.Body.data.refreshToken
if ($refresh) {
  $r = Api POST '/auth/refresh' -Body @{ refreshToken = $refresh }
  Record 'Auth' 'Refresh token' ($r.Ok)
} else { Record 'Auth' 'Refresh token' $false 'no refreshToken in login response' }

$r = Api POST '/auth/forgot-password' -Body @{ email = 'ngocanh@collabspace.dev' }
Record 'Auth' 'Forgot password' ($r.Ok -or $r.Code -eq 202)

# Register without OTP dev endpoint — expect verification required, not full verify
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$newEmail = "feat-test-$ts@example.com"
$r = Api POST '/auth/register' -Body @{ email = $newEmail; password = 'Demo@12345'; fullName = "Feat Test $ts" }
Record 'Auth' 'Register (no OTP in response)' ($r.Ok -and $r.Code -in 200,201) $(if ($r.Body.verificationRequired) { 'verificationRequired=true' })

# ── User directory ────────────────────────────────────────────────────────────
$r = Api GET '/users/me' -Headers $hA
$userAId = $r.Body.userId ?? $r.Body.id ?? $r.Body.data.userId
Record 'User' 'GET /users/me' ($r.Ok -and $userAId)

$r = Api PATCH '/users/me' -Headers $hA -Body @{ bio = "Feature verify $ts" }
Record 'User' 'PATCH /users/me' ($r.Ok)

$r = Api GET '/users/search?q=ngoc' -Headers $hA
Record 'User' 'Search users' ($r.Ok)

$r = Api GET '/users' -Headers $hA
Record 'User' 'List users' ($r.Ok)

if ($userAId) {
  $r = Api GET "/users/$userAId" -Headers $hA
  Record 'User' 'GET /users/:id' ($r.Ok)
  $r = Api POST '/users/bulk' -Headers $hA -Body @{ userIds = @($userAId) }
  Record 'User' 'Bulk profiles' ($r.Ok)
}

$r = Api GET '/users/me/preferences' -Headers $hA
Record 'User' 'GET preferences' ($r.Ok)

$r = Api PATCH '/users/me/preferences' -Headers $hA -Body @{ theme = 'dark' }
Record 'User' 'PATCH preferences' ($r.Ok)

$r = Api PATCH '/users/me/status' -Headers $hA -Body @{ status = 'online' }
Record 'User' 'PATCH status' ($r.Ok)

# ── Workspace + project ─────────────────────────────────────────────────────────
$r = Api GET '/workspaces' -Headers $hA
$wsId = $null
if ($r.Ok) {
  $list = $r.Body
  if ($list -isnot [array] -and $list.data) { $list = $list.data }
  if ($list -is [array] -and $list.Count -gt 0) { $wsId = $list[0].id }
}
Record 'Workspace' 'List workspaces' ($r.Ok -and $wsId) $(if ($wsId) { "ws=$wsId" })

if (-not $wsId) {
  $r = Api POST '/workspaces' -Headers $hA -Body @{ name = "Feat WS $ts"; description = 'verify' }
  if ($r.Ok) { $wsId = $r.Body.id ?? $r.Body.data.id }
  Record 'Workspace' 'Create workspace' ($r.Ok)
}

if ($wsId) {
  $r = Api GET "/workspaces/$wsId" -Headers $hA
  Record 'Workspace' 'Get workspace' ($r.Ok)

  $r = Api GET "/workspaces/$wsId/members" -Headers $hA
  Record 'Workspace' 'List members' ($r.Ok)

  $r = Api GET "/workspaces/$wsId/activity?limit=10" -Headers $hA
  Record 'Workspace' 'Activity feed' ($r.Ok)

  $r = Api GET "/workspaces/$wsId/invitations" -Headers $hA
  Record 'Workspace' 'List invitations' ($r.Ok)

  $r = Api GET "/workspaces/$wsId/projects" -Headers $hA
  $projId = $null
  if ($r.Ok) {
    $plist = $r.Body
    if ($plist -isnot [array] -and $plist.data) { $plist = $plist.data }
    if ($plist -is [array] -and $plist.Count -gt 0) { $projId = $plist[0].id }
  }
  Record 'Project' 'List projects' ($r.Ok)

  if (-not $projId) {
    $r = Api POST "/workspaces/$wsId/projects" -Headers $hA -Body @{ name = "Feat Project $ts" }
    $projId = $r.Body.id ?? $r.Body.data.id
    Record 'Project' 'Create project' ($r.Ok)
  } else { Record 'Project' 'Create project (seed exists)' $true "proj=$projId" }

  if ($projId) {
    $r = Api PATCH "/workspaces/$wsId/projects/$projId" -Headers $hA -Body @{ name = "Feat Project Updated $ts" }
    Record 'Project' 'Update project' ($r.Ok)
  }
}

# ── Task + board + comments ───────────────────────────────────────────────────
$taskId = $null
if ($wsId) {
  $r = Api POST '/tasks' -Headers $hA -Body @{ title = "Feat Task $ts"; workspaceId = $wsId; projectId = $projId; priority = 'HIGH' }
  $taskId = $r.Body.id ?? $r.Body.data.id
  Record 'Task' 'Create task' ($r.Ok -and $taskId)

  $r = Api GET "/tasks?workspaceId=$wsId" -Headers $hA
  Record 'Task' 'List tasks' ($r.Ok)

  $r = Api GET "/tasks/board?workspaceId=$wsId" -Headers $hA
  Record 'Task' 'Board API' ($r.Ok)

  if ($taskId) {
    $r = Api GET "/tasks/$taskId" -Headers $hA
    Record 'Task' 'Get task detail' ($r.Ok)

    $r = Api PATCH "/tasks/$taskId" -Headers $hA -Body @{ description = 'updated'; labels = @('feat','test') }
    Record 'Task' 'Update task details' ($r.Ok)

    $r = Api PATCH "/tasks/$taskId/status" -Headers $hB -Body @{ status = 'DOING' }
    Record 'Task' 'Update status (User B)' ($r.Ok)

    $r = Api GET '/users/me' -Headers $hB
    $userBId = $r.Body.userId ?? $r.Body.id
    $usernameB = $r.Body.username ?? 'ngo.quang.tien'

    $r = Api PATCH "/tasks/$taskId/assignee" -Headers $hA -Body @{ assigneeId = $userBId }
    Record 'Task' 'Assign task' ($r.Ok)

    $r = Api GET "/tasks/$taskId/activity?limit=10" -Headers $hA
    Record 'Task' 'Task activity feed' ($r.Ok)

    $content = "Hello @$usernameB from feature verify"
    $r = Api POST "/tasks/$taskId/comments" -Headers $hA -Body @{ content = $content }
    $commentId = $r.Body.id ?? $r.Body.data.id
    Record 'Comment' 'Create comment + mention' ($r.Ok -and $commentId)

    $r = Api GET "/tasks/$taskId/comments" -Headers $hA
    Record 'Comment' 'List comments' ($r.Ok)

    if ($commentId) {
      $r = Api PATCH "/tasks/$taskId/comments/$commentId" -Headers $hA -Body @{ content = 'edited comment' }
      Record 'Comment' 'Edit comment' ($r.Ok)
    }
  }
}

# ── Notifications ─────────────────────────────────────────────────────────────
Start-Sleep -Seconds 3
$r = Api GET '/notifications' -Headers $hB
$notifs = @()
if ($r.Ok) {
  $notifs = if ($r.Body -is [array]) { $r.Body }
    elseif ($r.Body.data -is [array]) { $r.Body.data }
    elseif ($r.Body.items -is [array]) { $r.Body.items }
    else { @() }
}
Record 'Notification' 'List notifications (User B)' ($r.Ok) "count=$($notifs.Count)"

if ($notifs.Count -gt 0) {
  $nid = $notifs[0].id ?? $notifs[0]._id
  $r = Api PATCH "/notifications/$nid/read" -Headers $hB -Body @{}
  Record 'Notification' 'Mark one read' ($r.Ok)
}
$r = Api PATCH '/notifications/read-all' -Headers $hB -Body @{}
Record 'Notification' 'Mark all read' ($r.Ok)

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "`n========== SUMMARY =========="
$ok = ($results | Where-Object Status -eq 'OK').Count
$fail = ($results | Where-Object Status -eq 'FAIL').Count
Write-Host "PASS: $ok | FAIL: $fail | TOTAL: $($results.Count)"
if ($fail -gt 0) {
  Write-Host "`nFailed:"
  $results | Where-Object Status -eq 'FAIL' | ForEach-Object { Write-Host "  - [$($_.Area)] $($_.Feature): $($_.Detail)" }
  exit 1
}
exit 0
