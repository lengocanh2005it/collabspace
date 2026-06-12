# Sinh secret ngẫu nhiên + phase0.env (IP Droplet, không cần domain).
# Chạy từ repo root trên Windows:
#   .\infrastructure\deploy\generate-phase0-secrets.ps1 -DropletIp 165.x.x.x
param(
  [Parameter(Mandatory = $true)]
  [string]$DropletIp,
  [string]$GhcrOwner = "lengocanh2005it",
  [string]$ImageTag = "",
  [string]$GhcrUsername = "",
  [string]$GhcrToken = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutFile = Join-Path $ScriptDir "phase0.env"

function New-RandomBase64([int]$Bytes = 32) {
  $buf = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  return [Convert]::ToBase64String($buf)
}

function New-RandomHex([int]$Bytes = 16) {
  $buf = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  return ([BitConverter]::ToString($buf) -replace "-", "").ToLower()
}

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
  Push-Location (Resolve-Path (Join-Path $ScriptDir "..\.."))
  try {
    $ImageTag = (git rev-parse origin/main 2>$null)
    if (-not $ImageTag) { $ImageTag = (git rev-parse HEAD) }
  } finally {
    Pop-Location
  }
}

if ([string]::IsNullOrWhiteSpace($GhcrUsername)) {
  $GhcrUsername = $GhcrOwner
}

$lines = @(
  "# Generated $(Get-Date -Format o) - KHONG commit file nay",
  "",
  "DROPLET_HOST=$DropletIp",
  "DROPLET_SSH_USER=root",
  "PROD_DOMAIN=$DropletIp",
  "",
  "GHCR_OWNER=$GhcrOwner",
  "IMAGE_TAG=$ImageTag",
  "GHCR_USERNAME=$GhcrUsername",
  "GHCR_TOKEN=$GhcrToken",
  "",
  "JWT_SECRET=$(New-RandomBase64)",
  "INTERNAL_SERVICE_TOKEN=$(New-RandomBase64)",
  "POSTGRES_PASSWORD=$(New-RandomBase64)",
  "MONGO_PASSWORD=$(New-RandomBase64)",
  "REDIS_PASSWORD=$(New-RandomBase64)",
  "RABBITMQ_PASSWORD=$(New-RandomBase64)",
  "RABBITMQ_USERNAME=collabspace",
  "METRICS_AUTH_TOKEN=$(New-RandomBase64)",
  "RABBITMQ_ERLANG_COOKIE=$(New-RandomHex)"
)

Set-Content -Path $OutFile -Value ($lines -join "`n") -Encoding utf8NoBOM
Write-Host "Wrote $OutFile"
Write-Host "IMAGE_TAG=$ImageTag (image phải tồn tại trên GHCR — build từ main)"
Write-Host "Next: .\infrastructure\deploy\prepare-prod-values.ps1"
