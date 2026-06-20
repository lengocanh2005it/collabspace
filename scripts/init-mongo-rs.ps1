# Initialize (or verify) MongoDB replica set rs0 for local Docker.
# Usage: .\scripts\init-mongo-rs.ps1

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$MongoHost = if ($env:MONGO_HOST) { $env:MONGO_HOST } else { "mongo" }
$MongoPort = if ($env:MONGO_PORT) { $env:MONGO_PORT } else { "27017" }
$MongoUser = if ($env:MONGO_USER) { $env:MONGO_USER } else { "admin" }
$MongoPass = if ($env:MONGO_PASS) { $env:MONGO_PASS } else { "password" }

$running = docker ps --format "{{.Names}}" | Select-String -Pattern "^mongo$" -Quiet
if (-not $running) {
  Write-Error "mongo container is not running. Start: cd infrastructure/docker && docker compose -f docker-compose.db.yml up -d mongo"
}

$initJs = Join-Path $Root "infrastructure\docker\mongo\init-replica-set.js"
docker cp $initJs mongo:/tmp/init-replica-set.js

docker exec mongo mongosh `
  --host $MongoHost `
  --port $MongoPort `
  -u $MongoUser `
  -p $MongoPass `
  --authenticationDatabase admin `
  --file /tmp/init-replica-set.js

docker exec mongo mongosh `
  -u $MongoUser `
  -p $MongoPass `
  --authenticationDatabase admin `
  --quiet `
  --eval "const s = rs.status(); print('rs.status().ok =', s.ok); quit(s.ok === 1 ? 0 : 1)"

Write-Host "Mongo replica set rs0 OK" -ForegroundColor Green
