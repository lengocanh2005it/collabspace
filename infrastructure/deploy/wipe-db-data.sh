#!/usr/bin/env bash
# Xóa toàn bộ dữ liệu trong DB trên k3s (giữ schema, chỉ truncate tables + drop Mongo collections).
# Dùng để reset demo data trên Droplet.
#
# Chạy từ máy local có kubectl context trỏ đến cluster:
#   bash infrastructure/deploy/wipe-db-data.sh
#
# Hoặc trên Droplet:
#   KUBECONFIG=/etc/rancher/k3s/k3s.yaml bash infrastructure/deploy/wipe-db-data.sh
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NS="collabspace"
APP_NS="$NS"
# shellcheck source=infrastructure/deploy/lib/postgres-target.sh
source "$(dirname "$0")/lib/postgres-target.sh"

# ── PostgreSQL ────────────────────────────────────────────────────────────────
PG_POD="$(postgres_primary_pod "$NS")"
PG_USER="postgres"

echo "==> PostgreSQL: truncate all tables in 3 databases (pod: $PG_POD)..."

for DB in collabspace_auth collabspace_user collabspace_workspace; do
  echo "    Wiping $DB..."
  kubectl exec -n "$NS" "$PG_POD" -c postgres -- psql -U "$PG_USER" -d "$DB" -c "
    DO \$\$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables
               WHERE schemaname = 'public' AND tablename != 'migrations'
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END \$\$;
  " && echo "    OK $DB"
done

# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGO_POD="$(kubectl get pods -n "$NS" -l app=mongo -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \
             kubectl get pods -n "$NS" -l app.kubernetes.io/name=mongodb -o jsonpath='{.items[0].metadata.name}')"

echo "==> MongoDB: drop all collections in task + notification databases..."

for DB in collabspace_task collabspace_notification; do
  echo "    Wiping $DB..."
  kubectl exec -n "$NS" "$MONGO_POD" -- mongosh \
    --quiet \
    --eval "
      db = db.getSiblingDB('$DB');
      db.getCollectionNames().forEach(function(col) {
        db[col].drop();
        print('  dropped: ' + col);
      });
      print('Done: $DB');
    " && echo "    OK $DB"
done

echo ""
echo "All data wiped. Migrations table preserved in Postgres (schema intact)."
echo "Re-run seed scripts if you need demo data:"
echo "  kubectl create job seed-all --from=cronjob/... -n $NS"
echo "  (or trigger seed manually per service)"
