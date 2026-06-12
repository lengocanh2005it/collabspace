# Copy kubeconfig từ Droplet k3s về máy Windows.
# Usage: .\fetch-kubeconfig.ps1 -DropletHost <IP> [-SshUser root]
param(
  [Parameter(Mandatory = $true)][string]$DropletHost,
  [string]$SshUser = "root",
  [string]$OutFile = "$env:USERPROFILE\.kube\collabspace-prod.yaml"
)

$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

scp "${SshUser}@${DropletHost}:/etc/rancher/k3s/k3s.yaml" $OutFile
(Get-Content $OutFile -Raw).Replace("127.0.0.1", $DropletHost) | Set-Content $OutFile -NoNewline

Write-Host "Wrote $OutFile"
Write-Host '$env:KUBECONFIG = "' + $OutFile + '"'
Write-Host "kubectl get nodes"
