param(
    [switch]$Local,
    [string]$ReleaseName = "collabspace",
    [string]$Namespace = "collabspace"
)

$ErrorActionPreference = "Stop"
$ChartDir = Join-Path $PSScriptRoot "..\collabspace" | Resolve-Path

if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
    Write-Error "Helm is not installed. Run: winget install Helm.Helm"
}

Write-Host "Updating Helm dependencies..."
helm dependency update $ChartDir

$helmArgs = @(
    "upgrade", "--install", $ReleaseName, $ChartDir,
    "--namespace", $Namespace,
    "--create-namespace",
    "-f", (Join-Path $ChartDir "values.yaml")
)

if ($Local) {
    $helmArgs += "-f", (Join-Path $ChartDir "values-local.yaml")
}

Write-Host "Installing release '$ReleaseName' into namespace '$Namespace'..."
& helm @helmArgs

kubectl get pods -n $Namespace
kubectl get svc traefik -n $Namespace 2>$null

Write-Host "Done. See infrastructure/helm/README.md"
