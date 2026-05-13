param(
    [switch]$Status,
    [switch]$Infra,
    [switch]$InfraDown,
    [switch]$InfraReset,
    [switch]$Db,
    [switch]$Migrate,
    [switch]$Seed
)

$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$projectRoot = Split-Path -Parent (Split-Path -Parent $rootDir)
$dockerDir = Join-Path $projectRoot "infrastructure\docker"
$scriptsDir = Join-Path $projectRoot "scripts"

if ($Status) {
    Write-Host "CollabSpace Infrastructure Status:" -ForegroundColor Cyan
    Set-Location $dockerDir
    docker-compose ps
    return
}

if ($InfraDown) {
    Set-Location $dockerDir
    docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.traefik.yml down
    return
}

if ($InfraReset) {
    Set-Location $dockerDir
    docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.traefik.yml down -v
    return
}

if ($Db) {
    Set-Location $scriptsDir
    bash init-db.sh
    return
}

if ($Migrate) {
    Set-Location $scriptsDir
    bash migrate.sh
    return
}

if ($Seed) {
    Set-Location $scriptsDir
    bash seed.sh
    return
}

Write-Host "Starting CollabSpace Infrastructure..." -ForegroundColor Green
Set-Location $dockerDir
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.traefik.yml up -d

if (-not $Infra) {
    Write-Host "Infrastructure started. Services should be run via 'pnpm run start:dev' or 'npm run start:dev' in their respective directories." -ForegroundColor Yellow
}
