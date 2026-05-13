@echo off
echo Stopping all infrastructure and services...
cd /d "%~dp0..\docker"
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.traefik.yml down
echo Done.
