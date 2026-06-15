# Tạo values-prod.yaml từ values-prod.example.yaml + phase0.env (Phase 0).
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir "..\..")
$HelmDir = Join-Path $RootDir "infrastructure\helm\collabspace"
$EnvFile = Join-Path $ScriptDir "phase0.env"
$Example = Join-Path $HelmDir "values-prod.example.yaml"
$Output = Join-Path $HelmDir "values-prod.yaml"

function Resolve-ImageTag {
  param(
    [string]$CallerImageTag,
    [string]$Phase0ImageTag
  )

  if (-not [string]::IsNullOrWhiteSpace($CallerImageTag)) {
    return @{ Tag = $CallerImageTag; Source = "explicit IMAGE_TAG" }
  }

  if ($env:REFRESH_IMAGE_TAG_FROM_GIT -ne "false") {
    Push-Location $RootDir
    try {
      $null = git rev-parse --verify origin/main 2>$null
      if ($LASTEXITCODE -eq 0) {
        $gitTag = (git rev-parse origin/main).Trim()
        return @{ Tag = $gitTag; Source = "git (origin/main)" }
      }
      $null = git rev-parse HEAD 2>$null
      if ($LASTEXITCODE -eq 0) {
        $gitTag = (git rev-parse HEAD).Trim()
        return @{ Tag = $gitTag; Source = "git (HEAD)" }
      }
    } finally {
      Pop-Location
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($Phase0ImageTag)) {
    return @{ Tag = $Phase0ImageTag; Source = "phase0.env" }
  }

  throw "Could not resolve IMAGE_TAG (set IMAGE_TAG, phase0.env, or run from a git checkout)."
}

if (-not (Test-Path $Example)) { throw "Missing $Example" }
if (-not (Test-Path $EnvFile)) {
  Write-Host "Create $EnvFile from phase0.env.example first."
  exit 1
}

$callerImageTag = $env:IMAGE_TAG

$vars = @{}
Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $idx = $line.IndexOf("=")
  if ($idx -lt 1) { return }
  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim()
  if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  $vars[$key] = $value
}

$phase0ImageTag = $vars["IMAGE_TAG"]
$resolved = Resolve-ImageTag -CallerImageTag $callerImageTag -Phase0ImageTag $phase0ImageTag
$vars["IMAGE_TAG"] = $resolved.Tag

if ($resolved.Tag -ne $phase0ImageTag) {
  Write-Host "IMAGE_TAG: $phase0ImageTag -> $($resolved.Tag) ($($resolved.Source))"
  if ($env:SKIP_PHASE0_IMAGE_TAG_SYNC -ne "1") {
    $envContent = Get-Content $EnvFile -Raw
    $updated = [regex]::Replace($envContent, '(?m)^IMAGE_TAG=.*$', "IMAGE_TAG=$($resolved.Tag)")
    Set-Content -Path $EnvFile -Value $updated -NoNewline
    Write-Host "Synced IMAGE_TAG into $EnvFile"
  }
}

$required = @(
  "GHCR_OWNER", "IMAGE_TAG", "JWT_SECRET", "SERVICE_JWT_SECRET",
  "POSTGRES_PASSWORD", "MONGO_PASSWORD", "REDIS_PASSWORD", "RABBITMQ_PASSWORD",
  "RABBITMQ_USERNAME", "METRICS_AUTH_TOKEN", "RABBITMQ_ERLANG_COOKIE", "PROD_DOMAIN",
  "AZURE_STORAGE_CONNECTION_STRING"
)
$missing = $required | Where-Object { -not $vars.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($vars[$_]) }
if ($missing.Count -gt 0) {
  Write-Host "Missing in $EnvFile :"; $missing | ForEach-Object { Write-Host "  - $_" }
  exit 1
}

$c = Get-Content $Example -Raw
$c = $c.Replace("REPLACE_ME_GHCR_OWNER", $vars["GHCR_OWNER"])
$c = $c.Replace("REPLACE_ME_IMAGE_TAG", $vars["IMAGE_TAG"])
$c = $c.Replace("REPLACE_ME_DOMAIN", $vars["PROD_DOMAIN"])
$c = $c.Replace('jwtSecret: "REPLACE_ME"', "jwtSecret: `"$($vars['JWT_SECRET'])`"")
$c = $c.Replace('serviceJwtSecret: "REPLACE_ME"', "serviceJwtSecret: `"$($vars['SERVICE_JWT_SECRET'])`"")
$c = $c.Replace('postgresPassword: "REPLACE_ME"', "postgresPassword: `"$($vars['POSTGRES_PASSWORD'])`"")
$c = $c.Replace('mongoPassword: "REPLACE_ME"', "mongoPassword: `"$($vars['MONGO_PASSWORD'])`"")
$c = $c.Replace('redisPassword: "REPLACE_ME"', "redisPassword: `"$($vars['REDIS_PASSWORD'])`"")
$c = $c.Replace('rabbitmqPassword: "REPLACE_ME"', "rabbitmqPassword: `"$($vars['RABBITMQ_PASSWORD'])`"")
$c = $c.Replace('metricsAuthToken: "REPLACE_ME"', "metricsAuthToken: `"$($vars['METRICS_AUTH_TOKEN'])`"")
$c = $c.Replace('azureStorageConnectionString: "REPLACE_ME_AZURE"', "azureStorageConnectionString: `"$($vars['AZURE_STORAGE_CONNECTION_STRING'])`"")
$c = $c.Replace('rootPassword: "REPLACE_ME"', "rootPassword: `"$($vars['MONGO_PASSWORD'])`"")
$c = $c.Replace('erlangCookie: "REPLACE_ME_ERLANG_COOKIE"', "erlangCookie: `"$($vars['RABBITMQ_ERLANG_COOKIE'])`"")
$c = $c.Replace("rabbitmqUsername: collabspace", "rabbitmqUsername: $($vars['RABBITMQ_USERNAME'])")
$c = $c.Replace("username: collabspace", "username: $($vars['RABBITMQ_USERNAME'])")

# Bitnami password fields còn lại (thứ tự: postgres → redis → rabbitmq)
$idx = $c.IndexOf('password: "REPLACE_ME"')
if ($idx -ge 0) { $c = $c.Remove($idx, 22).Insert($idx, "password: `"$($vars['POSTGRES_PASSWORD'])`"") }
$idx = $c.IndexOf('password: "REPLACE_ME"')
if ($idx -ge 0) { $c = $c.Remove($idx, 22).Insert($idx, "password: `"$($vars['REDIS_PASSWORD'])`"") }
$idx = $c.IndexOf('password: "REPLACE_ME"')
if ($idx -ge 0) { $c = $c.Remove($idx, 22).Insert($idx, "password: `"$($vars['RABBITMQ_PASSWORD'])`"") }

Set-Content -Path $Output -Value $c -NoNewline
Write-Host "Wrote $Output"
Write-Host "Next: seed Vault secret/collabspace/prod, then Phase 1 (k3s bootstrap)."
