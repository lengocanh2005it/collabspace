#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

echo "Running CollabSpace seed pipeline from $ROOT_DIR"
echo "Order: auth → user → workspace → task (user_replicas) → notification (user_replicas)"
echo "Source: scripts/demo-seed-data.json — DB only, no RabbitMQ"
echo "Dev (ts-node): default. Prod-style (dist/seed): SEED_MODE=prod $0"
echo ""

run_service_seed() {
  service_name="$1"
  service_dir="$2"
  echo "==> Seeding ${service_name}..."
  sh "${service_dir}/scripts/seed.sh"
}

run_service_seed "auth-service" "$ROOT_DIR/services/auth-service"
run_service_seed "user-service" "$ROOT_DIR/services/user-service"
run_service_seed "workspace-service" "$ROOT_DIR/services/workspace-service"
run_service_seed "task-service" "$ROOT_DIR/services/task-service"
run_service_seed "notification-service" "$ROOT_DIR/services/notification-service"

echo ""
echo "Seed pipeline completed successfully."
echo "Seed: 12 users, 4 workspaces — see scripts/demo-seed-data.json and README.md"
echo "Quick logins: ngocanh@ / quangtien@ (MVP) | tho@ / trungtin@ (platform admin) | dev.eve@ (pending invite)"
echo "Password: collabspace123"
