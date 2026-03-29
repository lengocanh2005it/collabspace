#!/bin/bash
# Remove test/dev data

echo "Cleaning PostgreSQL databases..."
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS collabspace_auth;"
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS collabspace_user;"
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS collabspace_workspace;"

echo "Cleaning MongoDB..."
mongo --eval "db.getSiblingDB('collabspace_task').dropDatabase()"

echo "Cleaning Redis..."
redis-cli FLUSHALL

echo "Cleanup completed!"