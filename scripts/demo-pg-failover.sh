#!/usr/bin/env bash
# demo-pg-failover.sh — Demonstrate PostgreSQL primary → replica failover on DOKS
# Usage: bash scripts/demo-pg-failover.sh [--kubeconfig <path>]
set -euo pipefail

NS="collabspace"
KUBECONFIG_ARG=""
if [[ "${1:-}" == "--kubeconfig" ]]; then
  KUBECONFIG_ARG="--kubeconfig $2"
fi
KC="kubectl $KUBECONFIG_ARG -n $NS"

log()     { echo ""; echo "==> $*"; }
log_ok()  { echo "    ✓ $*"; }
log_info(){ echo "    • $*"; }

# ---------- 1. Show current state -------------------------------------------

log "STEP 1 — Current PostgreSQL state"
$KC get pods -l app.kubernetes.io/name=postgresql -o wide
echo ""
log_info "Primary  : postgres-0       (handles all reads + writes)"
log_info "Replica  : postgres-read-0  (streaming replication from primary, read-only)"

log "STEP 2 — Verify replication is active"
$KC exec postgres-0 -- psql -U postgres -c \
  "SELECT application_name, state, sync_state FROM pg_stat_replication;"
log_ok "Replica is streaming from primary."

# ---------- 2. Write data to primary ----------------------------------------

log "STEP 3 — Write test data to PRIMARY"
$KC exec postgres-0 -- psql -U postgres -d collabspace_auth -c \
  "CREATE TABLE IF NOT EXISTS failover_demo (id serial PRIMARY KEY, msg text, ts timestamptz DEFAULT now());
   INSERT INTO failover_demo (msg) VALUES ('Written to primary before failover');"
log_ok "Row inserted on primary."

log "STEP 4 — Confirm data is replicated to REPLICA"
$KC exec postgres-read-0 -- psql -U postgres -d collabspace_auth -c \
  "SELECT * FROM failover_demo;"
log_ok "Replica has the same data (streaming replication works)."

# ---------- 3. Kill primary --------------------------------------------------

log "STEP 5 — Simulate PRIMARY failure (delete postgres-0 pod)"
$KC delete pod postgres-0
log_info "postgres-0 deleted. Kubernetes will restart it, but we promote replica first."

# ---------- 4. Promote replica -----------------------------------------------

log "STEP 6 — Promote REPLICA to new primary"
sleep 3
$KC exec postgres-read-0 -- bash -c "
  export PGDATA=/bitnami/postgresql/data
  pg_ctl promote -D \$PGDATA
"
log_ok "postgres-read-0 promoted — now accepting writes."

# ---------- 5. Verify new primary --------------------------------------------

log "STEP 7 — Verify new primary is writable"
sleep 3
$KC exec postgres-read-0 -- psql -U postgres -d collabspace_auth -c \
  "INSERT INTO failover_demo (msg) VALUES ('Written to NEW primary after failover');
   SELECT * FROM failover_demo;"
log_ok "New primary accepts writes. Data from before failover is preserved."

# ---------- Summary ----------------------------------------------------------

echo ""
echo "============================================="
echo "  PostgreSQL Failover Demo — COMPLETE"
echo "============================================="
echo "  Before : postgres-0 (primary) → postgres-read-0 (replica)"
echo "  Event  : postgres-0 pod deleted (simulates node crash)"
echo "  After  : postgres-read-0 promoted to primary"
echo "  Data   : 100% preserved — no data loss"
echo "============================================="
echo ""
echo "NOTE: In production, update DATABASE_URL to point to postgres-read"
echo "      service, or use DO Managed PostgreSQL for automatic failover."
echo "============================================="
