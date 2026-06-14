#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
SERVICE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$SERVICE_DIR"
pnpm run migrate
