#!/bin/bash
echo "Running load tests..."

for service in auth-service user-service workspace-service task-service notification-service; do
    echo "Testing $service..."
    k6 run k6/scripts/$service.js
done