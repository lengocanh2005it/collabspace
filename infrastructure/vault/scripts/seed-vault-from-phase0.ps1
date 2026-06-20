# Seed local Vault KV (collabspace/dev) from infrastructure/deploy/phase0.env.
# Use before sync-env-from-vault — secrets live in Vault, not in services/*/.env.
#
# Usage:
#   .\infrastructure\vault\scripts\seed-vault-from-phase0.ps1
#   .\infrastructure\vault\scripts\seed-vault-from-phase0.ps1 -UsePhase0InfraPasswords
#
# Default (-LocalDocker): postgres/mongo/redis passwords match docker-compose.db.yml
# and vault/.env.example so local stack connects. JWT/SERVICE_JWT/METRICS/Azure/Brevo from phase0.

param(
  [string]$Phase0Path = "",
  [switch]$UsePhase0InfraPasswords
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VaultDir = Split-Path -Parent $ScriptDir
$RepoRoot = Resolve-Path (Join-Path $VaultDir "..\..")

if ([string]::IsNullOrWhiteSpace($Phase0Path)) {
  $Phase0Path = Join-Path $RepoRoot "infrastructure\deploy\phase0.env"
}

if (-not (Test-Path $Phase0Path)) {
  throw "Missing $Phase0Path — create from phase0.env.example first."
}

function Load-DotEnv {
  param([string]$Path)
  $vars = @{}
  if (-not (Test-Path $Path)) { return $vars }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"')) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $vars[$key] = $val
  }
  return $vars
}

$phase0 = Load-DotEnv $Phase0Path
$vaultDefaults = Load-DotEnv (Join-Path $VaultDir ".env.example")
$vaultOverrides = Load-DotEnv (Join-Path $VaultDir ".env")

function Get-VaultConfig {
  param([string]$Key, [string]$Default = "")
  if ($vaultOverrides.ContainsKey($Key) -and $vaultOverrides[$Key] -ne "") { return $vaultOverrides[$Key] }
  if ($vaultDefaults.ContainsKey($Key)) { return $vaultDefaults[$Key] }
  return $Default
}

function Get-Phase0 {
  param([string]$Key, [string]$Default = "")
  if ($phase0.ContainsKey($Key) -and $phase0[$Key] -ne "") { return $phase0[$Key] }
  return $Default
}

$vaultAddr = $env:VAULT_ADDR
if (-not $vaultAddr) { $vaultAddr = Get-VaultConfig "VAULT_ADDR" "http://127.0.0.1:8200" }

$token = $env:VAULT_TOKEN
if (-not $token) { $token = Get-VaultConfig "VAULT_DEV_ROOT_TOKEN" "collabspace-dev-root" }

$kvPath = Get-VaultConfig "VAULT_KV_PATH" "collabspace/dev"

if (-not $UsePhase0InfraPasswords) {
  $pgPass = Get-VaultConfig "COLLABSPACE_POSTGRES_PASSWORD" "postgres"
  $mongoUser = Get-VaultConfig "COLLABSPACE_MONGO_USERNAME" "admin"
  $mongoPass = Get-VaultConfig "COLLABSPACE_MONGO_PASSWORD" "password"
  $redisPass = Get-VaultConfig "COLLABSPACE_REDIS_PASSWORD" "collabspace123"
} else {
  $pgPass = Get-Phase0 "POSTGRES_PASSWORD"
  $mongoUser = "admin"
  $mongoPass = Get-Phase0 "MONGO_PASSWORD"
  $redisPass = Get-Phase0 "REDIS_PASSWORD"
}

$payload = @{
  data = @{
    jwt_secret                     = Get-Phase0 "JWT_SECRET" (Get-VaultConfig "COLLABSPACE_JWT_SECRET")
    service_jwt_secret               = Get-Phase0 "SERVICE_JWT_SECRET" (Get-VaultConfig "COLLABSPACE_SERVICE_JWT_SECRET")
    postgres_password              = $pgPass
    mongo_username                 = $mongoUser
    mongo_password                 = $mongoPass
    redis_password                 = $redisPass
    metrics_auth_token             = Get-Phase0 "METRICS_AUTH_TOKEN"
    azure_storage_connection_string = Get-Phase0 "AZURE_STORAGE_CONNECTION_STRING"
    brevo_api_key                  = Get-Phase0 "BREVO_API_KEY"
  }
}

$uri = "$vaultAddr/v1/secret/data/$kvPath"
$headers = @{ "X-Vault-Token" = $token }

Write-Host "Seeding Vault secret/data/$kvPath from $Phase0Path ..."
if (-not $UsePhase0InfraPasswords) {
  Write-Host "(infra passwords: local Docker defaults — use -UsePhase0InfraPasswords for prod-like DB creds)"
}
Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 5) | Out-Null
Write-Host "Done. Next: strip-vault-secrets-from-env.ps1 && sync-env-from-vault.ps1"
