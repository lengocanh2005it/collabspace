#!/usr/bin/env pwsh
# Usage: ./scripts/typeorm-migrate/create-migration.ps1 <auth|user|workspace> <MigrationName>
param(
  [Parameter(Mandatory = $true)][ValidateSet('auth', 'user', 'workspace')][string]$Service,
  [Parameter(Mandatory = $true)][string]$Name
)

$Root = Resolve-Path (Join-Path $PSScriptRoot '../..')
$ServiceDir = Join-Path $Root "services/$Service-service"
$migrationsDir = Join-Path $ServiceDir 'migrations'
if (-not (Test-Path $migrationsDir)) { New-Item -ItemType Directory -Path $migrationsDir | Out-Null }
Push-Location $ServiceDir
try {
  pnpm exec typeorm migration:create "./migrations/$Name"
  Write-Host "Created migration under services/$Service-service/migrations/"
} finally {
  Pop-Location
}
