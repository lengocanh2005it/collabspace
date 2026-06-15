#!/usr/bin/env bash
# Kiểm tra readiness HTTP qua Traefik (hoặc BASE_URL tùy chỉnh).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/resolve-prod-api-base.sh"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"
READINESS_RETRIES="${READINESS_RETRIES:-12}"
READINESS_INTERVAL_SEC="${READINESS_INTERVAL_SEC:-10}"

resolve_base_url() {
  resolve_prod_api_base_url
}

check_readiness_once() {
  local failures=0
  local name url code

  for name in auth user workspace task notification; do
    url="${ENDPOINTS[$name]}"
    code="$(curl_prod_api_status "$url")"
    if [[ "$code" == "200" ]]; then
      echo "[OK]   $name ($code) $url"
    else
      echo "[FAIL] $name ($code) $url"
      failures=$((failures + 1))
    fi
  done

  return "$failures"
}

BASE="$(resolve_base_url)"
echo "Using API base: $BASE"
echo "Readiness probe: up to ${READINESS_RETRIES} attempts, ${READINESS_INTERVAL_SEC}s apart"

declare -A ENDPOINTS=(
  [auth]="${BASE}/auth/health/ready"
  [user]="${BASE}/users/health/ready"
  [workspace]="${BASE}/workspaces/health/ready"
  [task]="${BASE}/tasks/health/ready"
  [notification]="${BASE}/notifications/health/ready"
)

attempt=1
while [[ "$attempt" -le "$READINESS_RETRIES" ]]; do
  echo "==> Attempt ${attempt}/${READINESS_RETRIES}"
  if check_readiness_once; then
    echo "All services report ready via gateway."
    exit 0
  fi

  if [[ "$attempt" -lt "$READINESS_RETRIES" ]]; then
    echo "Some services not ready yet; waiting ${READINESS_INTERVAL_SEC}s..."
    sleep "$READINESS_INTERVAL_SEC"
  fi
  attempt=$((attempt + 1))
done

echo "Readiness check failed after ${READINESS_RETRIES} attempt(s)."
exit 1
