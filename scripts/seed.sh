#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

echo "Running seed scripts from $ROOT_DIR"

sh "$ROOT_DIR/services/auth-service/scripts/seed.sh"
sh "$ROOT_DIR/services/user-service/scripts/seed.sh"

echo "Seed data inserted successfully for auth-service and user-service."
