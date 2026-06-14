#!/bin/bash
# scripts/verify-env-parity.sh
# DevSecOps Parity Scanner: Ensures Helm charts do not drift from application .env.example contracts

echo "Scanning .env.example files for configuration drift..."
MISSING_COUNT=0

# Loop through all service environment templates
for env_file in services/*/.env.example; do
    echo "Checking $env_file..."
    # Extract keys: match lines starting with uppercase letters/numbers/underscores
    keys=$(grep -oE '^[A-Z0-9_]+' "$env_file" | sort -u)
    
    for key in $keys; do
        # Search for the exact key inside the Helm directory
        if ! grep -qR "$key" infrastructure/helm/collabspace; then
            echo "  ❌ [WARNING] Missing in Helm: $key"
            MISSING_COUNT=$((MISSING_COUNT + 1))
        fi
    done
done

if [ "$MISSING_COUNT" -gt 0 ]; then
    echo ""
    echo "⚠️ Found $MISSING_COUNT variables present in .env.example but completely missing from Helm charts."
    echo "Please add them to infrastructure/helm/collabspace/values.yaml (and configmap/secret.yaml if dynamic)."
    exit 1
else
    echo ""
    echo "✅ Perfect Parity: All .env.example variables are referenced in Helm!"
    exit 0
fi
