# One-shot: seed Vault from phase0.env → clear secrets in .env → write .env.vault for Docker.
#
# Usage (from repo root):
#   .\infrastructure\vault\scripts\reset-local-env-from-vault.ps1
#
# Prerequisite: docker compose -f infrastructure/docker/docker-compose.vault.yml up -d

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DockerDir = Resolve-Path (Join-Path $ScriptDir "..\..\docker")

Write-Host "==> Ensure Vault dev is running..."
Push-Location $DockerDir
try {
  docker compose -f docker-compose.vault.yml up -d
} finally {
  Pop-Location
}

Start-Sleep -Seconds 2

& (Join-Path $ScriptDir "seed-vault-from-phase0.ps1")
& (Join-Path $ScriptDir "strip-vault-secrets-from-env.ps1")
& (Join-Path $ScriptDir "sync-env-from-vault.ps1")

Write-Host "==> Done. services/*/.env = config only; secrets in .env.vault + Vault."
