#!/usr/bin/env bash
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_DIR="${APP_DIR:-/opt/collabspace}"
SYNC="/tmp/collabspace-sync"

mkdir -p "$APP_DIR/infrastructure/deploy/lib" "$APP_DIR/scripts"

for f in run-k8s-full-reset.sh run-k8s-seed.sh run-k8s-migrations.sh wipe-prod-data.sh vps-full-reset-now.sh; do
  tr -d '\r' < "$SYNC/$f" > "$APP_DIR/infrastructure/deploy/$f"
  chmod +x "$APP_DIR/infrastructure/deploy/$f"
done

for f in scale-app-services.sh; do
  tr -d '\r' < "$SYNC/deploy/lib/$f" > "$APP_DIR/infrastructure/deploy/lib/$f"
  chmod +x "$APP_DIR/infrastructure/deploy/lib/$f"
done

tr -d '\r' < "$SYNC/demo-seed-data.json" > "$APP_DIR/scripts/demo-seed-data.json"
if [[ -f "$SYNC/load-demo-seed-data.js" ]]; then
  tr -d '\r' < "$SYNC/load-demo-seed-data.js" > "$APP_DIR/scripts/load-demo-seed-data.js"
fi

bash -n "$APP_DIR/infrastructure/deploy/run-k8s-full-reset.sh"
echo "Scripts installed OK"

: > /tmp/k8s-full-reset.log
nohup bash "$APP_DIR/infrastructure/deploy/run-k8s-full-reset.sh" >> /tmp/k8s-full-reset.log 2>&1 &
echo "Full reset started PID=$!"
