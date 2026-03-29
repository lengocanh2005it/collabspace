#!/bin/bash
# Initialize all databases

echo "Initializing PostgreSQL for auth & user service..."
psql -h localhost -U postgres -c "CREATE DATABASE collabspace_auth;"
psql -h localhost -U postgres -c "CREATE DATABASE collabspace_user;"
psql -h localhost -U postgres -c "CREATE DATABASE collabspace_workspace;"

echo "Initializing MongoDB for task service..."
mongo --eval "db.getSiblingDB('collabspace_task')"

echo "Initializing Redis for notification service..."
redis-cli FLUSHALL

echo "Databases initialized successfully!"