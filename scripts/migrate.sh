#!/usr/bin/env bash
# Usage:
#   ./scripts/migrate.sh                       # migrate all Postgres services
#   ./scripts/migrate.sh auth                  # migrate one service
#   ./scripts/typeorm-migrate/create-migration.sh user AddMyColumn
#   ./scripts/typeorm-migrate/revert-migration.sh user

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ALL_SERVICES=(auth user workspace)

# ── helpers ────────────────────────────────────────────────────────────────────
log()  { echo ""; echo "▶  $*"; }
ok()   { echo "✓  $*"; }
fail() { echo "✗  $*" >&2; }

run_migrate() {
  local svc="$1"
  local dir="$ROOT_DIR/services/${svc}-service"

  if [[ ! -d "$dir" ]]; then
    fail "Service directory not found: $dir"
    return 1
  fi

  log "Migrating ${svc}-service …"
  (cd "$dir" && pnpm run migrate)
  ok "${svc}-service done"
}

# ── resolve target list ────────────────────────────────────────────────────────
if [[ $# -eq 0 ]]; then
  targets=("${ALL_SERVICES[@]}")
else
  targets=("$@")
fi

# ── validate names before running anything ─────────────────────────────────────
for t in "${targets[@]}"; do
  valid=false
  for s in "${ALL_SERVICES[@]}"; do
    [[ "$t" == "$s" ]] && valid=true && break
  done
  if [[ "$valid" == false ]]; then
    echo "Unknown service: '$t'"
    echo "Available: ${ALL_SERVICES[*]}"
    exit 1
  fi
done

# ── run ────────────────────────────────────────────────────────────────────────
failed=()
for t in "${targets[@]}"; do
  run_migrate "$t" || failed+=("$t")
done

echo ""
if [[ ${#failed[@]} -eq 0 ]]; then
  echo "All migrations completed."
else
  fail "Failed: ${failed[*]}"
  exit 1
fi
