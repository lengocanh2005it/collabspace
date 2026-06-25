# Seed CollabSpace dev secrets into HashiCorp Vault (KV v2).
# Prerequisite: Vault running (docker compose -f docker-compose.vault.yml up -d)
#
# Usage (from repo root or infrastructure/vault):
#   .\infrastructure\vault\scripts\seed-dev-secrets.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VaultDir = Split-Path -Parent $ScriptDir
$RepoRoot = Resolve-Path (Join-Path $VaultDir "..\..")

function Load-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @{} }
    $vars = @{}
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()
        $vars[$key] = $val
    }
    return $vars
}

$envFile = Join-Path $VaultDir ".env"
$defaults = Load-DotEnv (Join-Path $VaultDir ".env.example")
$overrides = Load-DotEnv $envFile

function Get-ConfigValue {
    param([string]$Key, [string]$Default = "")
    if ($overrides.ContainsKey($Key) -and $overrides[$Key] -ne "") { return $overrides[$Key] }
    if ($defaults.ContainsKey($Key)) { return $defaults[$Key] }
    return $Default
}

$vaultAddr = $env:VAULT_ADDR
if (-not $vaultAddr) { $vaultAddr = Get-ConfigValue "VAULT_ADDR" "http://127.0.0.1:8200" }

$token = $env:VAULT_TOKEN
if (-not $token) { $token = Get-ConfigValue "VAULT_DEV_ROOT_TOKEN" "collabspace-dev-root" }

$kvPath = Get-ConfigValue "VAULT_KV_PATH" "collabspace/dev"

$payload = @{
    data = @{
        jwt_secret                 = Get-ConfigValue "COLLABSPACE_JWT_SECRET" "collabspace-dev-jwt-secret-change-me"
        service_jwt_secret         = Get-ConfigValue "COLLABSPACE_SERVICE_JWT_SECRET" "collabspace-dev-service-jwt-secret-change-me"
        postgres_password          = Get-ConfigValue "COLLABSPACE_POSTGRES_PASSWORD" "postgres"
        mongo_username             = Get-ConfigValue "COLLABSPACE_MONGO_USERNAME" "admin"
        mongo_password             = Get-ConfigValue "COLLABSPACE_MONGO_PASSWORD" "password"
        redis_password             = Get-ConfigValue "COLLABSPACE_REDIS_PASSWORD" "collabspace123"
        metrics_auth_token         = Get-ConfigValue "COLLABSPACE_METRICS_AUTH_TOKEN" ""
        resend_api_key             = Get-ConfigValue "COLLABSPACE_RESEND_API_KEY" ""
    }
}

$uri = "$vaultAddr/v1/secret/data/$kvPath"
$headers = @{
    "X-Vault-Token" = $token
}

Write-Host "Seeding Vault KV at secret/data/$kvPath ..."
Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 5) | Out-Null
Write-Host "Done. Verify: vault kv get secret/$kvPath  (or open $vaultAddr/ui)"
