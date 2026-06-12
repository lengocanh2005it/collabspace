#!/usr/bin/env bash
# Run compiled seed.js in each service (same entrypoint as k8s Jobs / Docker images).
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

run_service_seed() {
  local service_name="$1"
  local service_dir="$2"
  echo "==> Seeding ${service_name} (seed:prod)..."
  (
    cd "$service_dir"
    if [[ ! -f dist/seed/seed.js ]]; then
      echo "Missing dist/seed/seed.js — run: pnpm run build (in ${service_name})"
      exit 1
    fi
    pnpm run seed:prod
  )
}

echo "CollabSpace prod-style seed pipeline from $ROOT_DIR"
echo "Order: auth-service -> user-service -> workspace-service -> task-service -> notification-service"
echo ""

run_service_seed "auth-service" "$ROOT_DIR/services/auth-service"
run_service_seed "user-service" "$ROOT_DIR/services/user-service"
run_service_seed "workspace-service" "$ROOT_DIR/services/workspace-service"
run_service_seed "task-service" "$ROOT_DIR/services/task-service"
run_service_seed "notification-service" "$ROOT_DIR/services/notification-service"

echo ""
echo "Seed pipeline completed."
echo "Demo users: ngocanh@collabspace.dev / quangtien@collabspace.dev — password collabspace123"
