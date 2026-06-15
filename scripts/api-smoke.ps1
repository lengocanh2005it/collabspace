# api-smoke.ps1 — smoke all public HTTP APIs (api-routes.md)
#Requires -Version 7
$ErrorActionPreference = 'Continue'
$BASE = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost/api/v1' }
$PASS = 'collabspace123'
$R = [System.Collections.Generic.List[object]]::new()

function Log([string]$Svc, [string]$Api, [string]$St, [string]$Note = '') {
  $R.Add([PSCustomObject]@{ Service = $Svc; API = $Api; Status = $St; Note = $Note })
  $c = switch ($St) { 'OK' { 'Green' } 'SKIP' { 'DarkGray' } default { 'Red' } }
  Write-Host "[$St] $Svc $Api $(if ($Note) { "($Note)" })" -ForegroundColor $c
}

function Api {
  param([string]$M, [string]$P, [hashtable]$H = @{}, [object]$B = $null, [string]$CT = 'application/json')
  $params = @{ Method = $M; Uri = "$BASE$P"; Headers = @{} + $H }
  if ($CT) { $params.Headers['Content-Type'] = $CT }
  if ($null -ne $B -and $B -is [string]) { $params.Body = $B }
  elseif ($null -ne $B) { $params.Body = ($B | ConvertTo-Json -Compress) }
  try {
    $resp = Invoke-WebRequest @params -UseBasicParsing
    return @{ Ok = $true; Code = [int]$resp.StatusCode; Body = ($resp.Content | ConvertFrom-Json -ErrorAction SilentlyContinue); Raw = $resp.Content }
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    $raw = $_.ErrorDetails.Message
    return @{ Ok = $false; Code = $code; Body = ($raw | ConvertFrom-Json -ErrorAction SilentlyContinue); Raw = $raw }
  }
}

function Login([string]$Email) {
  $x = Api POST '/auth/login' -B @{ email = $Email; password = $PASS }
  if (-not $x.Ok) { return $null }
  return $x.Body.accessToken
}

function AuthHeader([string]$T) { @{ Authorization = "Bearer $T" } }

Write-Host "API smoke — $BASE`n"

# ── AUTH ──────────────────────────────────────────────────────────────────────
foreach ($p in @('/auth/health', '/auth/health/live', '/auth/health/ready')) {
  $x = Api GET $p; Log 'auth' "GET $p" $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
}

$tokA = Login 'ngocanh@collabspace.dev'
$tokB = Login 'quangtien@collabspace.dev'
$tokAdmin = Login 'tho@collabspace.dev'
Log 'auth' 'POST /auth/login (seed)' $(if ($tokA -and $tokB) { 'OK' } else { 'FAIL' })

$hA = AuthHeader $tokA; $hB = AuthHeader $tokB; $hAdm = AuthHeader $tokAdmin

foreach ($item in @(
  @{ M = 'GET'; P = '/auth/me'; H = $hA; N = 'me' },
  @{ M = 'GET'; P = '/auth/verify'; H = $hA; N = 'verify' },
  @{ M = 'GET'; P = '/auth/sessions'; H = $hA; N = 'sessions' },
  @{ M = 'POST'; P = '/auth/forgot-password'; H = @{}; B = @{ email = 'ngocanh@collabspace.dev' }; N = 'forgot-password' },
  @{ M = 'POST'; P = '/auth/resend-verification-otp'; H = @{}; B = @{ email = 'new@x.com' }; N = 'resend-otp' }
)) {
  $x = Api $item.M $item.P -H $item.H -B $item.B
  $ok = $x.Ok -or ($item.N -eq 'resend-otp' -and $x.Code -in 400,404)
  Log 'auth' "$($item.M) $($item.P)" $(if ($ok) { 'OK' } else { 'FAIL' }) "$($item.N) HTTP $($x.Code)"
}

$lr = Api POST '/auth/login' -B @{ email = 'ngocanh@collabspace.dev'; password = $PASS }
$ref = $lr.Body.refreshToken
if ($ref) {
  $x = Api POST '/auth/refresh' -B @{ refreshToken = $ref }
  Log 'auth' 'POST /auth/refresh' $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
  $x = Api POST '/auth/logout' -H $hA -B @{ refreshToken = $ref }
  Log 'auth' 'POST /auth/logout' $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
}

$tokA = Login 'ngocanh@collabspace.dev'; $hA = AuthHeader $tokA

# ── USER ──────────────────────────────────────────────────────────────────────
foreach ($item in @(
  @{ M = 'GET'; P = '/users/me'; H = $hA },
  @{ M = 'PATCH'; P = '/users/me'; H = $hA; B = @{ bio = 'smoke test' } },
  @{ M = 'GET'; P = '/users/me/preferences'; H = $hA },
  @{ M = 'PATCH'; P = '/users/me/preferences'; H = $hA; B = @{ theme = 'light' } },
  @{ M = 'PATCH'; P = '/users/me/status'; H = $hA; B = @{ status = 'online' } },
  @{ M = 'GET'; P = '/users/search?q=ngoc'; H = $hA },
  @{ M = 'GET'; P = '/users?q=tien'; H = $hA }
)) {
  $x = Api $item.M $item.P -H $item.H -B $item.B
  Log 'user' "$($item.M) $($item.P)" $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
}

$me = (Api GET '/users/me' -H $hA).Body
$uid = $me.userId ?? $me.id
if ($uid) {
  foreach ($p in @("/users/$uid", "/users/$uid/summary")) {
    $x = Api GET $p -H $hA
    Log 'user' "GET $p" $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
  }
  $x = Api POST '/users/bulk' -H $hA -B @{ userIds = @($uid) }
  Log 'user' 'POST /users/bulk' $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
}

# ── WORKSPACE ─────────────────────────────────────────────────────────────────
$x = Api GET '/workspaces' -H $hA
$wsId = $null
if ($x.Ok -and $x.Body -is [array] -and $x.Body.Count -gt 0) { $wsId = $x.Body[0].id }
Log 'workspace' 'GET /workspaces' $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "count=$(if ($x.Body -is [array]){$x.Body.Count}else{'?'})"

if (-not $wsId) {
  $x = Api POST '/workspaces' -H $hA -B @{ name = "Smoke WS $(Get-Random)"; description = 'api smoke' }
  $wsId = $x.Body.id; Log 'workspace' 'POST /workspaces' $(if ($x.Ok) { 'OK' } else { 'FAIL' })
}

if ($wsId) {
  foreach ($item in @(
    @{ M = 'GET'; P = "/workspaces/$wsId" },
    @{ M = 'PATCH'; P = "/workspaces/$wsId"; B = @{ description = 'updated' } },
    @{ M = 'GET'; P = "/workspaces/$wsId/members" },
    @{ M = 'GET'; P = "/workspaces/$wsId/activity?limit=5" },
    @{ M = 'GET'; P = "/workspaces/$wsId/invitations" },
    @{ M = 'GET'; P = "/workspaces/$wsId/projects" }
  )) {
    $x = Api $item.M $item.P -H $hA -B $item.B
    Log 'workspace' "$($item.M) $($item.P)" $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
  }

  $x = Api POST "/workspaces/$wsId/projects" -H $hA -B @{ name = "Smoke Proj $(Get-Random)" }
  $projId = $x.Body.id
  Log 'workspace' "POST /workspaces/$wsId/projects" $(if ($x.Ok) { 'OK' } else { 'FAIL' })
  if ($projId) {
    $x = Api PATCH "/workspaces/$wsId/projects/$projId" -H $hA -B @{ name = 'Renamed' }
    Log 'workspace' 'PATCH project' $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
  }
}

# ── TASK ──────────────────────────────────────────────────────────────────────
$taskId = $null
if ($wsId) {
  $x = Api POST '/tasks' -H $hA -B @{ title = 'Smoke task'; workspaceId = $wsId; projectId = $projId; priority = 'MEDIUM' }
  $taskId = $x.Body.data.id ?? $x.Body.id
  Log 'task' 'POST /tasks' $(if ($x.Ok -and $taskId) { 'OK' } else { 'FAIL' })

  foreach ($p in @("/tasks?workspaceId=$wsId", "/tasks/board?workspaceId=$wsId")) {
    $x = Api GET $p -H $hA
    Log 'task' "GET $p" $(if ($x.Ok) { 'OK' } else { 'FAIL' })
  }

  if ($taskId) {
    foreach ($item in @(
      @{ M = 'GET'; P = "/tasks/$taskId" },
      @{ M = 'GET'; P = "/tasks/$taskId/activity?limit=5" },
      @{ M = 'PATCH'; P = "/tasks/$taskId/details"; B = @{ title = 'Smoke task'; description = 'd'; labels = @('smoke') } },
      @{ M = 'PATCH'; P = "/tasks/$taskId/status"; B = @{ status = 'DOING' }; H = $hB },
      @{ M = 'GET'; P = "/tasks/$taskId/comments" },
      @{ M = 'POST'; P = "/tasks/$taskId/comments"; B = @{ content = '@ngo.quang.tien smoke' } }
    )) {
      $hh = if ($item.H) { $item.H } else { $hA }
      $x = Api $item.M $item.P -H $hh -B $item.B
      Log 'task' "$($item.M) $($item.P)" $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
    }
    $bid = (Api GET '/users/me' -H $hB).Body.userId
    $x = Api PATCH "/tasks/$taskId/assignee" -H $hA -B @{ assigneeId = $bid }
    Log 'task' 'PATCH assignee' $(if ($x.Ok) { 'OK' } else { 'FAIL' })
  }
}

# ── NOTIFICATION ──────────────────────────────────────────────────────────────
Start-Sleep -Seconds 2
$x = Api GET '/notifications?limit=10' -H $hB
Log 'notification' 'GET /notifications' $(if ($x.Ok) { 'OK' } else { 'FAIL' })
$items = $x.Body.notifications ?? @()
if ($items.Count -gt 0) {
  $nid = $items[0].id
  $x = Api PATCH "/notifications/$nid/read" -H $hB -B @{}
  Log 'notification' 'PATCH /:id/read' $(if ($x.Ok) { 'OK' } else { 'FAIL' })
}
$x = Api PATCH '/notifications/read-all' -H $hB -B @{}
Log 'notification' 'PATCH /read-all' $(if ($x.Ok) { 'OK' } else { 'FAIL' })

# ── ADMIN (tho@) ──────────────────────────────────────────────────────────────
if ($tokAdmin) {
  foreach ($p in @('/auth/admin/roles', '/auth/admin/permissions', '/auth/admin/users', '/users/admin/all', '/workspaces/admin/all')) {
    $x = Api GET $p -H $hAdm
    Log 'admin' "GET $p" $(if ($x.Ok) { 'OK' } else { 'FAIL' }) "HTTP $($x.Code)"
  }
}

# ── SUMMARY ───────────────────────────────────────────────────────────────────
Write-Host "`n======== SUMMARY ========"
$ok = @($R | Where-Object Status -eq 'OK').Count
$fail = @($R | Where-Object Status -eq 'FAIL').Count
Write-Host "OK: $ok | FAIL: $fail | Total: $($R.Count)"
if ($fail -gt 0) {
  Write-Host "`nFailed APIs:"
  $R | Where-Object Status -eq 'FAIL' | ForEach-Object { Write-Host "  $($_.Service) $($_.API) $($_.Note)" }
}
