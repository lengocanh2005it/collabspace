#!/bin/bash
# Seed sample data

echo "Seeding auth-service..."
cd ../services/auth-service && node prisma/seed.js

echo "Seeding user-service..."
cd ../services/user-service && node prisma/seed.js

echo "Seeding workspace-service..."
cd ../services/workspace-service && ./gradlew runSeed

echo "Seeding task-service..."
cd ../services/task-service && node seed.js

echo "Seed data inserted successfully!"