#!/bin/bash
# ================================
# Generic Deploy Script for CollabSpace Services
# Pulls latest image and restarts the service via Docker Compose
# Usage: ./deploy.sh <service-name>
# ================================
set -e

SERVICE_NAME="${1}"
COMPOSE_DIR="${2:-/opt/collabspace/infrastructure/docker}"

if [ -z "$SERVICE_NAME" ]; then
    echo "ERROR: Service name required"
    echo "Usage: ./deploy.sh <service-name> [compose-dir]"
    exit 1
fi

echo "=== Deploying $SERVICE_NAME ==="

cd "$COMPOSE_DIR"

# Pull latest image
echo "Pulling latest image for $SERVICE_NAME..."
docker-compose -f docker-compose.yml -f docker-compose.override.yml pull "$SERVICE_NAME" || true

# Restart the service
echo "Restarting $SERVICE_NAME..."
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d --no-deps "$SERVICE_NAME"

# Wait and verify health
echo "Waiting for $SERVICE_NAME to become healthy..."
sleep 10

CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$SERVICE_NAME" 2>/dev/null || echo "not found")
if [ "$CONTAINER_STATUS" = "running" ]; then
    echo "=== $SERVICE_NAME deployed successfully (status: running) ==="
else
    echo "WARNING: $SERVICE_NAME status is '$CONTAINER_STATUS'"
    docker logs "$SERVICE_NAME" --tail 20
    exit 1
fi