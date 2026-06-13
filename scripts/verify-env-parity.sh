#!/usr/bin/env bash

# Verify that variables declared in local .env.example files are correctly mapped in Helm ConfigMaps/Secrets
# Run this from the root of the collabspace directory

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Environment Parity Check...${NC}"

# Find all .env.example files
ENV_FILES=$(find services -name ".env.example")
HELM_CONFIG="infrastructure/helm/collabspace/templates/apps/configmap.yaml"
HELM_SECRET="infrastructure/helm/collabspace/templates/apps/secret.yaml"

MISSING_VARS=0

for ENV_FILE in $ENV_FILES; do
  SERVICE_DIR=$(dirname "$ENV_FILE")
  SERVICE_NAME=$(basename "$SERVICE_DIR")
  
  echo "Checking $SERVICE_NAME..."
  
  # Extract keys from .env.example
  KEYS=$(grep -v '^#' "$ENV_FILE" | grep -v '^$' | cut -d '=' -f 1)
  
  for KEY in $KEYS; do
    # Check if the key exists in configmap, secret, values, or deployment
    if ! grep -q "$KEY:" "$HELM_CONFIG" && ! grep -q "$KEY:" "$HELM_SECRET" && ! grep -q "$KEY:" "infrastructure/helm/collabspace/values.yaml" && ! grep -q "name: $KEY" "infrastructure/helm/collabspace/templates/apps/deployment.yaml"; then
      echo -e "  ${RED}[MISSING]${NC} Key '$KEY' is in $ENV_FILE but not found in Helm configs!"
      MISSING_VARS=$((MISSING_VARS + 1))
    fi
  done
done

if [ "$MISSING_VARS" -gt 0 ]; then
  echo -e "${RED}Environment parity check failed! Found $MISSING_VARS unmapped variables.${NC}"
  echo "Please update infrastructure/helm/collabspace/templates/apps/configmap.yaml or secret.yaml"
  exit 1
else
  echo -e "${GREEN}All environment variables are perfectly mapped!${NC}"
  exit 0
fi
