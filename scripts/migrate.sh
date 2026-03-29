#!/bin/bash
# Run migrations for each service

echo "Running migrations for auth-service..."
cd ../services/auth-service && npx prisma migrate deploy

echo "Running migrations for user-service..."
cd ../services/user-service && npx prisma migrate deploy

echo "Running migrations for workspace-service..."
cd ../services/workspace-service && ./gradlew flywayMigrate

echo "Running migrations for task-service (MongoDB)..."
cd ../services/task-service && node migrate.js

echo "All migrations completed!"