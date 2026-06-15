#!/usr/bin/env bash
# Outbox + Graphile worker diagnostics (prod ops).
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
PGPASS="$(kubectl get secret auth-service-secrets -n "$APP_NS" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"

echo "=== Auth outbox env (auth pod) ==="
kubectl exec -n "$APP_NS" deploy/auth-service -- env | grep -iE '^OUTBOX_|^GRAPHILE_|^EMAIL_' | sort || true

echo ""
echo "=== Outbox rows (unprocessed) ==="
kubectl exec -n "$APP_NS" postgres-0 -- env PGPASSWORD="$PGPASS" psql -U postgres -d collabspace_auth -c \
  "SELECT left(id::text, 8) AS id,
          attempt_count,
          failed_at IS NOT NULL AS failed,
          claimed_at IS NOT NULL AS claimed,
          round(EXTRACT(EPOCH FROM (NOW() - claimed_at))) AS claimed_age_s,
          left(coalesce(last_error, ''), 40) AS err,
          payload->>'email' AS email
   FROM auth_outbox_events
   WHERE processed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 12;"

echo ""
echo "=== Graphile emails.send jobs (last 5) ==="
kubectl exec -n "$APP_NS" deploy/auth-service -- node -e "
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const jobs = await client.query(
    \"SELECT id, attempts, max_attempts, locked_at, last_error IS NOT NULL AS errored
     FROM graphile_worker.jobs
     WHERE task_identifier = 'emails.send'
     ORDER BY id DESC LIMIT 5\",
  );
  console.log(jobs.rows.length ? jobs.rows : 'no emails.send jobs');
  await client.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
" 2>&1 || echo "(graphile query failed)"

echo ""
echo "=== Recent auth outbox logs ==="
kubectl logs -n "$APP_NS" deploy/auth-service --since=120s 2>&1 \
  | grep -iE 'Publishing auth|queued for delivery|publish failed|publish timed|Reclaimed|GraphileEmails|Brevo' \
  | tail -20 || true
