# Orchestrator: Phase 0 (local) -> clone repo (PAT) -> Phase 1-3 (SSH).
param(
  [Parameter(Mandatory = $true)]
  [string]$DropletIp,
  [string]$SshUser = "root",
  [string]$SshKeyPath = "",
  [string]$GhcrOwner = "lengocanh2005it",
  [string]$GitBranch = "main",
  [switch]$SkipPhase1,
  [switch]$RegenerateSecrets
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Phase0 = Join-Path $ScriptDir "phase0.env"
$GitSyncScript = Join-Path $ScriptDir "git-sync-private-repo.sh"

function Get-Phase0Value([string]$Name) {
  if (-not (Test-Path $Phase0)) { return "" }
  foreach ($line in Get-Content $Phase0) {
    $t = $line.Trim()
    if ($t -match "^\s*#") { continue }
    if ($t -match "^${Name}=(.*)$") { return $matches[1].Trim() }
  }
  return ""
}

function Invoke-Ssh([string]$RemoteCmd) {
  $sshArgs = @("-o", "StrictHostKeyChecking=accept-new")
  if ($SshKeyPath -ne "") { $sshArgs += @("-i", $SshKeyPath) }
  $sshArgs += "${SshUser}@${DropletIp}", $RemoteCmd
  & ssh @sshArgs
  if ($LASTEXITCODE -ne 0) { throw "SSH failed" }
}

function Invoke-Scp([string]$LocalPath, [string]$RemotePath) {
  $scpArgs = @("-o", "StrictHostKeyChecking=accept-new")
  if ($SshKeyPath -ne "") { $scpArgs += @("-i", $SshKeyPath) }
  $scpArgs += $LocalPath, "${SshUser}@${DropletIp}:${RemotePath}"
  & scp @scpArgs
  if ($LASTEXITCODE -ne 0) { throw "SCP failed: $LocalPath" }
}

Write-Host "=== CollabSpace Droplet deploy ==="
Write-Host "Droplet: $DropletIp | Branch: $GitBranch"

if ($RegenerateSecrets -or -not (Test-Path $Phase0)) {
  & (Join-Path $ScriptDir "generate-phase0-secrets.ps1") -DropletIp $DropletIp -GhcrOwner $GhcrOwner
}

$gitToken = Get-Phase0Value "GITHUB_TOKEN"
if ([string]::IsNullOrWhiteSpace($gitToken)) { $gitToken = Get-Phase0Value "GHCR_TOKEN" }
if ([string]::IsNullOrWhiteSpace($gitToken)) {
  throw "Thieu GITHUB_TOKEN hoac GHCR_TOKEN trong phase0.env (PAT can repo + read:packages)."
}

& (Join-Path $ScriptDir "prepare-prod-values.ps1")

Write-Host "==> Clone/pull private repo on Droplet..."
Invoke-Ssh "mkdir -p /tmp/collabspace-bootstrap"
Invoke-Scp $Phase0 "/tmp/collabspace-bootstrap/phase0.env"
Invoke-Scp $GitSyncScript "/tmp/collabspace-bootstrap/git-sync-private-repo.sh"
Invoke-Ssh "sed -i 's/\r$//' /tmp/collabspace-bootstrap/git-sync-private-repo.sh /tmp/collabspace-bootstrap/phase0.env 2>/dev/null || true; chmod +x /tmp/collabspace-bootstrap/git-sync-private-repo.sh && PHASE0_ENV=/tmp/collabspace-bootstrap/phase0.env GIT_BRANCH=$GitBranch bash /tmp/collabspace-bootstrap/git-sync-private-repo.sh"

if (-not $SkipPhase1) {
  Write-Host "==> Phase 1: k3s bootstrap (10-20 min)..."
  Invoke-Ssh "cd /opt/collabspace && bash infrastructure/deploy/k3s-bootstrap.sh && bash infrastructure/deploy/verify-phase1.sh"
} else {
  Write-Host "==> Skipping Phase 1"
}

& (Join-Path $ScriptDir "upload-prod-config-to-doks.ps1") -DropletIp $DropletIp -SshUser $SshUser -SshKeyPath $SshKeyPath

Write-Host "==> Phase 2-3: Vault + Helm (15-40 min)..."
$phase23 = "set -euo pipefail; cd /opt/collabspace && " +
  "sudo bash infrastructure/deploy/vault-eso-phase2.sh && " +
  "sudo bash infrastructure/deploy/verify-phase2.sh && " +
  "sudo bash infrastructure/deploy/helm-deploy-phase3.sh && " +
  "sudo bash infrastructure/deploy/verify-phase3.sh"
Invoke-Ssh $phase23

Write-Host ""
Write-Host "=== Done Phase 0-3 ==="
Write-Host "API: http://${DropletIp}/api/v1"
Write-Host "Test: curl http://${DropletIp}/api/v1/auth/health/ready"
