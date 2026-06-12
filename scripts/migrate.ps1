# Usage:
#   .\scripts\migrate.ps1                          # migrate all services
#   .\scripts\migrate.ps1 auth                     # migrate one service
#   .\scripts\migrate.ps1 auth workspace user      # migrate multiple services

param(
  [string[]] $Services = @()
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path "$PSScriptRoot\..").Path
$AllServices = @('auth', 'user', 'workspace')

function Write-Log  { param($msg) Write-Host ""; Write-Host "▶  $msg" }
function Write-Ok   { param($msg) Write-Host "✓  $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "✗  $msg" -ForegroundColor Red }

function Invoke-Migrate {
  param([string] $Svc)
  $Dir = Join-Path $Root "services\$Svc-service"

  if (-not (Test-Path $Dir)) {
    Write-Fail "Service directory not found: $Dir"
    return $false
  }

  Write-Log "Migrating $Svc-service ..."
  Push-Location $Dir
  try {
    pnpm run migrate
    Write-Ok "$Svc-service done"
    return $true
  } catch {
    Write-Fail "$Svc-service failed: $_"
    return $false
  } finally {
    Pop-Location
  }
}

# ── resolve target list ────────────────────────────────────────────────────────
$Targets = if ($Services.Count -eq 0) { $AllServices } else { $Services }

# ── validate names ─────────────────────────────────────────────────────────────
foreach ($t in $Targets) {
  if ($t -notin $AllServices) {
    Write-Host "Unknown service: '$t'"
    Write-Host "Available: $($AllServices -join ', ')"
    exit 1
  }
}

# ── run ────────────────────────────────────────────────────────────────────────
$Failed = @()
foreach ($t in $Targets) {
  $ok = Invoke-Migrate $t
  if (-not $ok) { $Failed += $t }
}

Write-Host ""
if ($Failed.Count -eq 0) {
  Write-Host "All migrations completed." -ForegroundColor Green
} else {
  Write-Fail "Failed: $($Failed -join ', ')"
  exit 1
}
