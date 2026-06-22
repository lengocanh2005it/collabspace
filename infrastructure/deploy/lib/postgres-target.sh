#!/usr/bin/env bash
# Helpers for PostgreSQL targets during the Bitnami -> CloudNativePG transition.
set -euo pipefail

postgres_cluster_name() {
  printf '%s\n' "${POSTGRES_CLUSTER_NAME:-postgres}"
}

postgres_superuser_secret_name() {
  printf '%s\n' "${POSTGRES_SUPERUSER_SECRET:-postgres-superuser}"
}

postgres_is_cnpg() {
  local ns="${1:-${APP_NS:-collabspace}}"
  kubectl get cluster "$(postgres_cluster_name)" -n "$ns" >/dev/null 2>&1
}

postgres_password() {
  local ns="${1:-${APP_NS:-collabspace}}"
  local cnpg_secret
  cnpg_secret="$(postgres_superuser_secret_name)"

  if kubectl get secret "$cnpg_secret" -n "$ns" >/dev/null 2>&1; then
    kubectl get secret "$cnpg_secret" -n "$ns" -o jsonpath='{.data.password}' | base64 -d
    return
  fi

  kubectl get secret postgres -n "$ns" -o jsonpath='{.data.postgres-password}' | base64 -d
}

postgres_primary_pod() {
  local ns="${1:-${APP_NS:-collabspace}}"
  local cluster
  cluster="$(postgres_cluster_name)"

  if postgres_is_cnpg "$ns"; then
    kubectl get cluster "$cluster" -n "$ns" -o jsonpath='{.status.currentPrimary}'
    return
  fi

  printf '%s\n' postgres-0
}

wait_postgres_ready() {
  local ns="${1:-${APP_NS:-collabspace}}"
  local timeout="${2:-300s}"
  local cluster
  cluster="$(postgres_cluster_name)"

  if postgres_is_cnpg "$ns"; then
    kubectl wait "cluster/${cluster}" -n "$ns" --for=condition=Ready --timeout="$timeout"
    return
  fi

  kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=postgresql -n "$ns" --timeout="$timeout"
}

postgres_psql() {
  local ns="${1:-${APP_NS:-collabspace}}"
  shift
  local pod
  local pgpass
  pod="$(postgres_primary_pod "$ns")"
  pgpass="$(postgres_password "$ns")"
  kubectl exec -i -n "$ns" "$pod" -- env PGPASSWORD="$pgpass" psql -U postgres "$@"
}
