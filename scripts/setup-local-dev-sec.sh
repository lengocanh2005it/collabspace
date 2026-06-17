#!/bin/bash
# scripts/setup-local-dev-sec.sh
# -------------------------------------------------------------------------
# Paved Road Script: Local DevSecOps Scaffolding
# Sets up a local Vault instance via Docker Compose, seeds it, and installs
# External Secrets Operator (ESO) locally so local dev perfectly mirrors prod.
# -------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR=$(dirname "$0")
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

echo "🚀 [1/3] Starting Local Vault instance..."
cd "$PROJECT_ROOT/infrastructure/vault"
docker-compose -f docker-compose.vault.yml up -d

echo "⏳ Waiting for Vault to initialize..."
sleep 5

echo "🌱 [2/3] Seeding Local Vault with dummy secrets..."
# Assumes seed-dev-secrets.sh exists in infrastructure/vault/scripts/
if [ -f "$PROJECT_ROOT/infrastructure/vault/scripts/seed-dev-secrets.sh" ]; then
  bash "$PROJECT_ROOT/infrastructure/vault/scripts/seed-dev-secrets.sh"
else
  echo "⚠️ Warning: seed-dev-secrets.sh not found, skipping Vault seeding."
fi

echo "📦 [3/3] Installing External Secrets Operator (ESO) to local Kubernetes..."
helm repo add external-secrets https://charts.external-secrets.io || true
helm repo update
helm upgrade --install external-secrets external-secrets/external-secrets \
    -n external-secrets --create-namespace \
    --set installCRDs=true

echo "✅ DevSecOps Local Scaffolding Complete!"
echo "You can now safely run: helm install collabspace ./infrastructure/helm/collabspace"
