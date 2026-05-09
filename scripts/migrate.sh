#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

sh "$ROOT_DIR/services/auth-service/scripts/migrate.sh"
sh "$ROOT_DIR/services/user-service/scripts/migrate.sh"

echo "Auth and user migrations completed."
