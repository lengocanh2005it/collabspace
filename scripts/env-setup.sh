#!/bin/bash
# Set environment variables for services

export POSTGRES_HOST=localhost
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export MONGO_URI=mongodb://localhost:27017
export REDIS_HOST=localhost
export REDIS_PORT=6379
export JWT_SECRET=supersecretkey

echo "Environment variables set!"