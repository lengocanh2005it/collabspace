#!/usr/bin/env bash
# Wait for a Kubernetes Job with periodic status + logs on failure.
# Usage: source this file, then: wait_k8s_job collabspace migrate-auth-service-123 300
set -euo pipefail

k8s_job_log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

dump_k8s_job_failure() {
  local ns="$1"
  local job_name="$2"
  local label="job-name=${job_name}"

  k8s_job_log "ERROR: Job ${job_name} failed — collecting diagnostics..."
  kubectl describe "job/${job_name}" -n "$ns" 2>/dev/null | tail -30 || true
  echo "--- pod events ---"
  kubectl get pods -n "$ns" -l "$label" -o wide 2>/dev/null || true
  local pod
  for pod in $(kubectl get pods -n "$ns" -l "$label" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
    echo "--- logs: ${pod} ---"
    kubectl logs -n "$ns" "$pod" --all-containers --tail=120 2>/dev/null || true
  done
}

wait_k8s_job() {
  local ns="$1"
  local job_name="$2"
  local timeout="${3:-300}"
  local poll="${4:-5}"
  local waited=0
  local label="job-name=${job_name}"

  k8s_job_log "Waiting for job/${job_name} (timeout=${timeout}s, image poll every ${poll}s)..."

  while [[ "$waited" -lt "$timeout" ]]; do
    local complete failed pod pod_phase reason
    complete="$(kubectl get "job/${job_name}" -n "$ns" -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || true)"
    failed="$(kubectl get "job/${job_name}" -n "$ns" -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null || true)"
    pod="$(kubectl get pods -n "$ns" -l "$label" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
    pod_phase="$(kubectl get pod "$pod" -n "$ns" -o jsonpath='{.status.phase}' 2>/dev/null || echo "-")"
    reason="$(kubectl get pod "$pod" -n "$ns" -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null || true)"

    k8s_job_log "  job=${job_name} t=${waited}s pod=${pod:-pending} phase=${pod_phase} waiting=${reason:-none}"

    if [[ "$complete" == "True" ]]; then
      k8s_job_log "OK  job/${job_name} completed (${waited}s)"
      kubectl logs -n "$ns" "job/${job_name}" --tail=40 2>/dev/null || true
      return 0
    fi

    if [[ "$failed" == "True" ]]; then
      dump_k8s_job_failure "$ns" "$job_name"
      return 1
    fi

    sleep "$poll"
    waited=$((waited + poll))
  done

  k8s_job_log "ERROR: Timed out waiting for job/${job_name} after ${timeout}s"
  dump_k8s_job_failure "$ns" "$job_name"
  return 1
}
