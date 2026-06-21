# Upload phase0.env + values-prod.yaml len Droplet.
param(
  [Parameter(Mandatory = $true)]
  [string]$DropletIp,
  [string]$SshUser = "root",
  [string]$SshKeyPath = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Phase0 = Join-Path $ScriptDir "phase0.env"
$ValuesProd = Join-Path (Split-Path $ScriptDir -Parent) "helm\collabspace\values-prod.yaml"

foreach ($f in @($Phase0, $ValuesProd)) {
  if (-not (Test-Path $f)) {
    Write-Host "Missing $f - run prepare-prod-values.ps1 first."
    exit 1
  }
}

$sshArgs = @("-o", "StrictHostKeyChecking=accept-new")
if ($SshKeyPath -ne "") { $sshArgs += @("-i", $SshKeyPath) }
$sshArgs += "${SshUser}@${DropletIp}"

$remote = "/opt/collabspace"
Write-Host "==> Ensuring $remote exists on Droplet..."
& ssh @sshArgs "mkdir -p $remote/infrastructure/deploy $remote/infrastructure/helm/collabspace"

$scpArgs = @("-o", "StrictHostKeyChecking=accept-new")
if ($SshKeyPath -ne "") { $scpArgs += @("-i", $SshKeyPath) }

Write-Host "==> Uploading phase0.env..."
& scp @scpArgs $Phase0 "${SshUser}@${DropletIp}:${remote}/infrastructure/deploy/phase0.env"

Write-Host "==> Uploading values-prod.yaml..."
& scp @scpArgs $ValuesProd "${SshUser}@${DropletIp}:${remote}/infrastructure/helm/collabspace/values-prod.yaml"

Write-Host "Done."
