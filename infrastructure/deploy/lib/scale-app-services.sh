#!/usr/bin/env bash
# Scale CollabSpace app Deployments to 0 and wait until pods are gone (no DB writers).
# Usage: source after k8s-job-wait.sh (for k8s_job_log) or standalone with echo.
set -euo pipefail

COLLABSPACE_APP_DEPLOYMENTS=(
  auth-service
  user-service
  workspace-service
  task-service
  notification-service
)

scale_app_services_to_zero() {
  local ns="${1:-${APP_NS:-collabspace}}"
  k8s_job_log "Scaling app deployments to 0 in namespace ${ns}..."
  for dep in "${COLLABSPACE_APP_DEPLOYMENTS[@]}"; do
    if kubectl get deployment "$dep" -n "$ns" >/dev/null 2>&1; then
      kubectl scale "deployment/${dep}" -n "$ns" --replicas=0
      k8s_job_log "  scaled ${dep} → 0"
    else
      k8s_job_log "  skip ${dep} (deployment not found)"
    fi
  done
}

wait_app_services_stopped() {
  local ns="${1:-${APP_NS:-collabspace}}"
  local timeout="${2:-180}"
  local waited=0
  local poll=5

  k8s_job_log "Waiting for app pods to terminate (timeout=${timeout}s)..."
  sleep 5

  while [[ "$waited" -lt "$timeout" ]]; do
    local remaining=0
    for dep in "${COLLABSPACE_APP_DEPLOYMENTS[@]}"; do
      local count
      count="$(kubectl get pods -n "$ns" -l "app=${dep}" --field-selector=status.phase!=Succeeded 2>/dev/null \
        | tail -n +2 | wc -l | tr -d ' ')"
      remaining=$((remaining + count))
    done

    if [[ "$remaining" -eq 0 ]]; then
      k8s_job_log "OK  all app pods stopped (${waited}s)"
      sleep 3
      return 0
    fi

    k8s_job_log "  ${remaining} app pod(s) still running (t=${waited}s)..."
    sleep "$poll"
    waited=$((waited + poll))
  done

  k8s_job_log "WARN: timed out waiting for app pods — listing remaining:"
  kubectl get pods -n "$ns" 2>/dev/null | grep -E 'auth-service|user-service|workspace-service|task-service|notification-service' || true
  return 1
}

terminate_postgres_app_sessions() {
  local ns="${1:-${APP_NS:-collabspace}}"
  local pgpass
  pgpass="$(kubectl get secret postgres -n "$ns" -o jsonpath='{.data.postgres-password}' | base64 -d)"

  k8s_job_log "Terminating leftover PostgreSQL sessions on app databases..."
  for db in collabspace_auth collabspace_user collabspace_workspace; do
    kubectl exec -n "$ns" postgres-0 -- env PGPASSWORD="$pgpass" psql -U postgres -v ON_ERROR_STOP=0 -c \
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();" \
      >/dev/null 2>&1 || true
  done
}

# Scale to 0, wait for pods, terminate PG sessions — call before wipe / migrate / seed.
ensure_app_services_stopped() {
  local ns="${1:-${APP_NS:-collabspace}}"
  scale_app_services_to_zero "$ns"
  wait_app_services_stopped "$ns" "${APP_STOP_TIMEOUT:-180}"
  terminate_postgres_app_sessions "$ns"
}
