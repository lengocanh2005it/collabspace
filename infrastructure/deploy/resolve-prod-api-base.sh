#!/usr/bin/env bash
# Resolve production API base URL for smoke tests on the Droplet.
# After Traefik TLS, HTTP on :80 returns 301/308 — use HTTPS + --resolve for domain prod.
#
# Priority: BASE_URL env > PROD_DOMAIN from phase0.env (HTTPS) > http://127.0.0.1/api/v1
set -euo pipefail

resolve_prod_api_base_url() {
  if [[ -n "${BASE_URL:-}" ]]; then
    echo "${BASE_URL%/}"
    return 0
  fi

  local phase0="${PHASE0_ENV:-}"
  if [[ -z "$phase0" ]]; then
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    phase0="$script_dir/phase0.env"
  fi

  local domain=""
  if [[ -f "$phase0" ]]; then
    domain="$(
      grep -E '^PROD_DOMAIN=' "$phase0" | head -1 | cut -d= -f2- | tr -d ' "' || true
    )"
  fi

  # Hostname (not bare IPv4) — Traefik redirects HTTP → HTTPS when TLS is enabled.
  if [[ -n "$domain" && "$domain" == *.* && ! "$domain" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "https://${domain}/api/v1"
    return 0
  fi

  echo "http://127.0.0.1/api/v1"
}

prod_api_domain_from_base() {
  local base="${1%/}"
  if [[ "$base" == https://* ]]; then
    echo "$base" | sed -E 's#^https://([^/]+)/.*#\1#'
    return 0
  fi
  return 1
}

# curl HTTP status for gateway readiness / smoke (handles local HTTPS via --resolve).
curl_prod_api_status() {
  local url="$1"
  if [[ "$url" == https://* ]]; then
    local domain
    domain="$(prod_api_domain_from_base "$url")" || return 1
    curl -skS --resolve "${domain}:443:127.0.0.1" -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000"
  else
    curl -sS -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000"
  fi
}

install_prod_api_curl_wrapper() {
  local base
  base="$(resolve_prod_api_base_url)"
  if [[ "$base" != https://* ]]; then
    return 0
  fi
  local domain
  domain="$(prod_api_domain_from_base "$base")" || return 0
  # Exported functions cannot close over local vars in child shells (demo-e2e uses set -u).
  export PROD_API_CURL_RESOLVE_DOMAIN="$domain"
  curl() {
    command curl -skS --resolve "${PROD_API_CURL_RESOLVE_DOMAIN}:443:127.0.0.1" "$@"
  }
  export -f curl
}
