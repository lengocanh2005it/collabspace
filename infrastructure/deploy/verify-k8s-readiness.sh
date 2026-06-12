#!/usr/bin/env bash
# Kiểm tra readiness HTTP qua Traefik (hoặc BASE_URL tùy chỉnh).
set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"

resolve_base_url() {
  if [[ -n "${BASE_URL:-}" ]]; then
    echo "${BASE_URL%/}"
    return
  fi

  local ip port
  ip="$(kubectl get svc traefik -n "$APP_NS" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
  if [[ -z "$ip" ]]; then
    ip="$(kubectl get svc traefik -n "$APP_NS" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
  ip="$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
    ip="$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)"
  fi

  port="$(kubectl get svc traefik -n "$APP_NS" -o jsonpath='{.spec.ports[?(@.name=="web")].port}' 2>/dev/null || echo 80)"
  if [[ -z "$ip" ]]; then
    echo "Cannot resolve Traefik address. Set BASE_URL=http://<host>/api/v1" >&2
    exit 1
  fi

  if [[ "$port" == "80" ]]; then
    echo "http://${ip}/api/v1"
  else
    echo "http://${ip}:${port}/api/v1"
  fi
}

BASE="$(resolve_base_url)"
echo "Using API base: $BASE"

declare -A ENDPOINTS=(
  [auth]="${BASE}/auth/health/ready"
  [user]="${BASE}/users/health/ready"
  [workspace]="${BASE}/workspaces/health/ready"
  [task]="${BASE}/tasks/health/ready"
  [notification]="${BASE}/notifications/health/ready"
)

failures=0
for name in auth user workspace task notification; do
  url="${ENDPOINTS[$name]}"
  code="$(curl -fsS -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")"
  if [[ "$code" == "200" ]]; then
    echo "[OK]   $name ($code) $url"
  else
    echo "[FAIL] $name ($code) $url"
    failures=$((failures + 1))
  fi
done

if [[ "$failures" -gt 0 ]]; then
  echo "Readiness check failed: $failures service(s)."
  exit 1
fi

echo "All services report ready via gateway."
