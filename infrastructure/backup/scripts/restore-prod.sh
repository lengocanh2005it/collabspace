#!/usr/bin/env bash
# Restore a CollabSpace backup from DO Spaces — credentials auto-loaded from
# Vault CLI or K8s secret (backup-spaces-secret).
#
# Usage:
#   ./restore-prod.sh [snapshot-stamp]
#
# Args:
#   snapshot-stamp  e.g. 20260620/20260620T020000Z
#                   Omit to list available snapshots.
#
# Credential resolution order:
#   1. DO_SPACES_KEY / DO_SPACES_SECRET already set in env → use directly
#   2. vault CLI available + VAULT_ADDR set → read kv/backup-spaces-secret
#   3. kubectl available → read backup-spaces-secret from K8s (Droplet)
#   4. Error with instructions
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP="${1:-}"

# ── 1. Already in env ─────────────────────────────────────────────────────────
if [[ -n "${DO_SPACES_KEY:-}" && -n "${DO_SPACES_SECRET:-}" ]]; then
  echo "==> Using DO_SPACES_KEY / DO_SPACES_SECRET from environment"

# ── 2. Vault CLI ──────────────────────────────────────────────────────────────
elif command -v vault &>/dev/null && [[ -n "${VAULT_ADDR:-}" ]]; then
  echo "==> Reading credentials from Vault ($VAULT_ADDR)"
  VAULT_PATH="${VAULT_PATH:-kv/data/backup-spaces-secret}"
  RAW=$(vault kv get -format=json "$VAULT_PATH" 2>/dev/null \
        || vault read -format=json "$VAULT_PATH" 2>/dev/null)
  export DO_SPACES_KEY=$(echo "$RAW" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('data',d.get('data',{})).get('doSpacesKey','') or d['data']['doSpacesKey'])" 2>/dev/null \
    || echo "$RAW" | grep -oP '"doSpacesKey"\s*:\s*"\K[^"]+')
  export DO_SPACES_SECRET=$(echo "$RAW" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('data',d.get('data',{})).get('doSpacesSecret','') or d['data']['doSpacesSecret'])" 2>/dev/null \
    || echo "$RAW" | grep -oP '"doSpacesSecret"\s*:\s*"\K[^"]+')
  if [[ -z "${DO_SPACES_KEY:-}" || -z "${DO_SPACES_SECRET:-}" ]]; then
    echo "ERROR: could not parse doSpacesKey/doSpacesSecret from Vault response"
    exit 1
  fi
  echo "==> Credentials loaded from Vault"

# ── 3. kubectl (K8s secret on Droplet) ───────────────────────────────────────
elif command -v kubectl &>/dev/null; then
  NS="${K8S_NAMESPACE:-collabspace}"
  echo "==> Reading credentials from K8s secret backup-spaces-secret (ns: $NS)"
  export DO_SPACES_KEY=$(kubectl get secret backup-spaces-secret -n "$NS" \
    -o jsonpath='{.data.doSpacesKey}' | base64 -d)
  export DO_SPACES_SECRET=$(kubectl get secret backup-spaces-secret -n "$NS" \
    -o jsonpath='{.data.doSpacesSecret}' | base64 -d)
  if [[ -z "${DO_SPACES_KEY:-}" || -z "${DO_SPACES_SECRET:-}" ]]; then
    echo "ERROR: backup-spaces-secret missing doSpacesKey or doSpacesSecret"
    exit 1
  fi
  echo "==> Credentials loaded from K8s secret"

# ── 4. Give up ────────────────────────────────────────────────────────────────
else
  echo "ERROR: cannot find DO Spaces credentials. Try one of:"
  echo "  export DO_SPACES_KEY=xxx DO_SPACES_SECRET=yyy && $0 [stamp]"
  echo "  VAULT_ADDR=http://vault:8200 VAULT_TOKEN=xxx $0 [stamp]"
  echo "  (on Droplet) kubectl must be configured and backup-spaces-secret present"
  exit 1
fi

exec "$SCRIPT_DIR/restore-from-spaces.sh" "$STAMP"
