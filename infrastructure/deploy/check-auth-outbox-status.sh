#!/usr/bin/env bash
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/postgres-target.sh
source "$SCRIPT_DIR/lib/postgres-target.sh"
APP_NS="${APP_NS:-collabspace}"
postgres_psql "$APP_NS" -d collabspace_auth -c \
  "SELECT event_type, attempt_count, processed_at IS NOT NULL AS sent, failed_at IS NOT NULL AS failed, left(coalesce(last_error,''), 200) AS last_error, payload->>'email' AS email FROM auth_outbox_events ORDER BY created_at DESC LIMIT 8;"
