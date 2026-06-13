# Run the CollabSpace k6 SLO baseline against the API gateway.
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$loadTestScript = Join-Path $repoRoot "infrastructure\load-testing\run-load-test.sh"

if (-not $env:BASE_URL) {
  $env:BASE_URL = "http://localhost/api/v1"
}
if (-not $env:K6_VUS) {
  $env:K6_VUS = "10"
}
if (-not $env:K6_DURATION) {
  $env:K6_DURATION = "2m"
}

if (Get-Command k6 -ErrorAction SilentlyContinue) {
  $scenario = Join-Path $repoRoot "infrastructure\load-testing\k6\scenarios\slo-baseline.js"
  Write-Host "==> k6 scenario: slo-baseline"
  Write-Host "    BASE_URL=$($env:BASE_URL)"
  k6 run $scenario
  exit $LASTEXITCODE
}

if (Get-Command bash -ErrorAction SilentlyContinue) {
  bash $loadTestScript slo-baseline
  exit $LASTEXITCODE
}

throw "k6 not found. Install k6 or run via Docker Compose loadtest profile."
