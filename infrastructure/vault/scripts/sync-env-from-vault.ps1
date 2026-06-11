# Pull shared secrets from Vault and update service .env files (local Docker dev).
# Non-secret keys in .env are preserved.
#
# Usage:
#   .\infrastructure\vault\scripts\sync-env-from-vault.ps1

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

$defaults = Load-DotEnv (Join-Path $VaultDir ".env.example")
$overrides = Load-DotEnv (Join-Path $VaultDir ".env")

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
$uri = "$vaultAddr/v1/secret/data/$kvPath"
$headers = @{ "X-Vault-Token" = $token }

Write-Host "Reading secret/data/$kvPath from $vaultAddr ..."
$response = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
$secrets = $response.data.data

$jwt = $secrets.jwt_secret
$internal = $secrets.internal_service_token
$pgPass = $secrets.postgres_password
$mongoUser = $secrets.mongo_username
$mongoPass = $secrets.mongo_password
$redisPass = $secrets.redis_password
$rmqUser = $secrets.rabbitmq_username
$rmqPass = $secrets.rabbitmq_password
$metrics = $secrets.metrics_auth_token

function Set-EnvKey {
    param(
        [string]$FilePath,
        [string]$Key,
        [string]$Value
    )
    if (-not (Test-Path $FilePath)) {
        Write-Warning "Skip missing file: $FilePath"
        return
    }
    $lines = Get-Content $FilePath
    $found = $false
    $newLines = foreach ($line in $lines) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
            $found = $true
            "$Key=$Value"
        } else {
            $line
        }
    }
    if (-not $found) {
        $newLines += "$Key=$Value"
    }
    Set-Content -Path $FilePath -Value $newLines -Encoding utf8
}

function Update-UrlPassword {
    param(
        [string]$FilePath,
        [string]$User,
        [string]$Password,
        [string]$Pattern
    )
    if (-not (Test-Path $FilePath)) { return }
    $content = Get-Content $FilePath -Raw
    $userEnc = [uri]::EscapeDataString($User)
    $passEnc = [uri]::EscapeDataString($Password)
    $newContent = [regex]::Replace($content, $Pattern, {
        param($match)
        "$($match.Groups[1].Value)${userEnc}:${passEnc}@"
    })
    if ($newContent -ne $content) {
        Set-Content -Path $FilePath -Value $newContent.TrimEnd() -Encoding utf8
    }
}

$services = Join-Path $RepoRoot "services"

$authEnv = Join-Path $services "auth-service\.env"
$userEnv = Join-Path $services "user-service\.env"
$wsEnv = Join-Path $services "workspace-service\.env"
$taskEnv = Join-Path $services "task-service\.env"
$notifEnv = Join-Path $services "notification-service\.env"

foreach ($f in @($authEnv, $userEnv, $wsEnv, $taskEnv, $notifEnv)) {
    if (-not (Test-Path $f)) {
        $example = "$f.example"
        if (Test-Path $example) {
            Copy-Item $example $f
            Write-Host "Created $f from .env.example"
        }
    }
}

Set-EnvKey $authEnv "JWT_SECRET" $jwt
Set-EnvKey $notifEnv "JWT_SECRET" $jwt

Set-EnvKey $userEnv "INTERNAL_SERVICE_TOKEN" $internal
Set-EnvKey $wsEnv "INTERNAL_SERVICE_TOKEN" $internal
Set-EnvKey $taskEnv "INTERNAL_SERVICE_TOKEN" $internal
Set-EnvKey $notifEnv "INTERNAL_SERVICE_TOKEN" $internal

if ($metrics) {
    foreach ($f in @($authEnv, $userEnv, $wsEnv, $taskEnv, $notifEnv)) {
        Set-EnvKey $f "METRICS_AUTH_TOKEN" $metrics
    }
}

Update-UrlPassword $authEnv "postgres" $pgPass '(postgresql://)[^@]+@'
Update-UrlPassword $userEnv "postgres" $pgPass '(postgresql://)[^@]+@'
Update-UrlPassword $wsEnv "postgres" $pgPass '(postgresql://)[^@]+@'

Update-UrlPassword $taskEnv $mongoUser $mongoPass '(mongodb://)[^@]+@'
Update-UrlPassword $notifEnv $mongoUser $mongoPass '(mongodb://)[^@]+@'

$rmqPattern = '(amqp://)[^@]+@'
foreach ($f in @($authEnv, $userEnv, $wsEnv, $taskEnv, $notifEnv)) {
    Update-UrlPassword $f $rmqUser $rmqPass $rmqPattern
}

Set-EnvKey $authEnv "REDIS_PASSWORD" $redisPass
Set-EnvKey $notifEnv "REDIS_PASSWORD" $redisPass

Write-Host "Synced Vault secrets into service .env files."
Write-Host "Next: cd infrastructure/docker && docker compose ... up -d"
