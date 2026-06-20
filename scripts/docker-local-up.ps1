# Start local Docker stack with Vault bootstrap (.env config + .env.vault secrets).
#
# Usage (from repo root):
#   .\scripts\docker-local-up.ps1              # built images (Dockerfile.service + cache) — default
#   .\scripts\docker-local-up.ps1 -Kafka
#   .\scripts\docker-local-up.ps1 -Dev         # hot-reload: pnpm install + start:dev per container
#   .\scripts\docker-local-up.ps1 -Build       # force docker compose --build
#   .\scripts\docker-local-up.ps1 -SkipVault   # stack only, Vault/env already synced

param(
  [switch]$SkipVault,
  [switch]$Dev,
  [switch]$Build,
  [switch]$Kafka,
  [switch]$Monitoring,
  [switch]$Traefik
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DockerDir = Join-Path $ProjectRoot "infrastructure\docker"
$VaultReset = Join-Path $ProjectRoot "infrastructure\vault\scripts\reset-local-env-from-vault.ps1"

if (-not $SkipVault) {
  Write-Host "==> Vault bootstrap (up → seed → strip .env → sync .env.vault)..." -ForegroundColor Cyan
  & $VaultReset
}

$composeArgs = @(
  "compose",
  "-f", "docker-compose.yml",
  "-f", "docker-compose.db.yml"
)
if ($Dev) {
  Write-Host "==> Dev mode: hot-reload (override.yml — pnpm install on each start)" -ForegroundColor Yellow
  $composeArgs += "-f", "docker-compose.override.yml"
} else {
  Write-Host "==> Built images: Dockerfile.service (pnpm cache in build layers)" -ForegroundColor Cyan
  $composeArgs += "-f", "docker-compose.local.yml"
}
if ($Kafka) { $composeArgs += "-f", "docker-compose.kafka.yml" }
if ($Monitoring -and $Dev) { $composeArgs += "-f", "docker-compose.monitoring.yml" }
if ($Traefik) { $composeArgs += "-f", "docker-compose.traefik.yml" }
$composeArgs += "up", "-d"
if ($Build) { $composeArgs += "--build" }

Write-Host "==> Starting Docker stack..." -ForegroundColor Green
Push-Location $DockerDir
try {
  & docker @composeArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host "==> Stack is up. Check: cd infrastructure/docker && docker compose ps" -ForegroundColor Green
