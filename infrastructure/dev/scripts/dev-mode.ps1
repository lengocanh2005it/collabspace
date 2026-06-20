param(
    [switch]$Status,
    [switch]$Infra,
    [switch]$InfraDown,
    [switch]$InfraReset,
    [switch]$Db,
    [switch]$Migrate,
    [switch]$Seed,
    [switch]$SkipVault,
    [switch]$Dev,
    [switch]$Build,
    [switch]$Kafka,
    [switch]$Traefik
)

$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$projectRoot = Split-Path -Parent (Split-Path -Parent $rootDir)
$dockerDir = Join-Path $projectRoot "infrastructure\docker"
$scriptsDir = Join-Path $projectRoot "scripts"
$vaultReset = Join-Path $projectRoot "infrastructure\vault\scripts\reset-local-env-from-vault.ps1"

function Get-ComposeArgs {
    param([switch]$Dev, [switch]$Kafka, [switch]$Traefik)
    $args = @("-f", "docker-compose.yml", "-f", "docker-compose.db.yml")
    if ($Dev) {
        $args += "-f", "docker-compose.override.yml"
    } else {
        $args += "-f", "docker-compose.local.yml"
    }
    if ($Kafka) { $args += "-f", "docker-compose.kafka.yml" }
    if ($Traefik) { $args += "-f", "docker-compose.traefik.yml" }
    return $args
}

if ($Status) {
    Write-Host "CollabSpace Infrastructure Status:" -ForegroundColor Cyan
    Set-Location $dockerDir
    docker compose ps
    return
}

$composeFiles = Get-ComposeArgs -Dev:$Dev -Kafka:$Kafka -Traefik:$Traefik

if ($InfraDown) {
    Set-Location $dockerDir
    docker compose @composeFiles down
    return
}

if ($InfraReset) {
    Set-Location $dockerDir
    docker compose @composeFiles down -v
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

if (-not $SkipVault) {
    Write-Host "==> Vault bootstrap (seed → strip .env → sync .env.vault)..." -ForegroundColor Cyan
    & $vaultReset
}

Set-Location $dockerDir
if ($Build) {
    docker compose @composeFiles up -d --build
} else {
    docker compose @composeFiles up -d
}

if (-not $Infra) {
    if ($Dev) {
        Write-Host "Infrastructure started (Vault + Docker dev/hot-reload via override.yml)." -ForegroundColor Yellow
    } else {
        Write-Host "Infrastructure started (Vault + built images via Dockerfile.service)." -ForegroundColor Yellow
    }
    Write-Host "Optional: -Dev hot-reload | -Build rebuild | -Kafka | -SkipVault" -ForegroundColor DarkGray
}
