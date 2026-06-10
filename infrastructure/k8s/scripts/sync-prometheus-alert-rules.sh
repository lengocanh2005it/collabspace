#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RULES_FILE="$ROOT/monitoring/alert-rules.yml"

kubectl create configmap prometheus-alert-rules \
  --from-file=alert-rules.yml="$RULES_FILE" \
  -n collabspace \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Synced alert-rules.yml to configmap/prometheus-alert-rules in collabspace"
