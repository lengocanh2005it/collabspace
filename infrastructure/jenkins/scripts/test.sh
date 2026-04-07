#!/bin/bash
# ================================
# Generic Test Script for CollabSpace Services
# Detects service type (Node.js vs Java/Gradle) and runs appropriate tests
# Usage: ./test.sh <service-directory>
# ================================
set -e

SERVICE_DIR="${1:-.}"

cd "$SERVICE_DIR"

echo "=== Running tests in $(pwd) ==="

# Detect service type and run tests
if [ -f "package.json" ]; then
    echo "Detected: Node.js service"
    npm install
    npm test
elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
    echo "Detected: Gradle (Java/Kotlin) service"
    ./gradlew test --no-daemon
elif [ -f "pom.xml" ]; then
    echo "Detected: Maven (Java) service"
    ./mvnw test
else
    echo "ERROR: Unknown service type — no package.json, build.gradle, or pom.xml found"
    exit 1
fi

echo "=== Tests completed successfully ==="