#!/usr/bin/env bash
# Phase 2 — Cài Vault + External Secrets Operator trên k3s; seed + sync secrets.
# Chạy trên Droplet (root hoặc user có kubectl) sau Phase 1.
#
#   cd /opt/collabspace
#   sudo bash infrastructure/deploy/vault-eso-phase2.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/collabspace}"
VAULT_NS="${VAULT_NS:-vault}"
ESO_NS="${ESO_NS:-external-secrets}"
APP_NS="${APP_NS:-collabspace}"
VAULT_RELEASE="${VAULT_RELEASE:-vault}"
ESO_RELEASE="${ESO_RELEASE:-external-secrets}"
VAULT_POD="${VAULT_POD:-vault-0}"
INIT_FILE="${VAULT_INIT_FILE:-$APP_DIR/infrastructure/vault/.vault-k3s-init.json}"
ESO_TOKEN_FILE="${VAULT_ESO_TOKEN_FILE:-$APP_DIR/infrastructure/vault/.vault-k3s-eso-token.json}"
PHASE0_ENV="${PHASE0_ENV:-$APP_DIR/infrastructure/deploy/phase0.env}"

export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

if ! command -v kubectl >/dev/null 2>&1 || ! command -v helm >/dev/null 2>&1; then
  echo "kubectl and helm required (run Phase 1 bootstrap first)."
  exit 1
fi

cd "$APP_DIR"

echo "==> Phase 2: Vault + ESO"

echo "==> Adding Helm repos..."
helm repo add hashicorp https://helm.releases.hashicorp.com >/dev/null 2>&1 || true
helm repo add external-secrets https://charts.external-secrets.io >/dev/null 2>&1 || true
helm repo update

echo "==> Installing External Secrets Operator..."
if ! helm status "$ESO_RELEASE" -n "$ESO_NS" >/dev/null 2>&1; then
  kubectl create namespace "$ESO_NS" --dry-run=client -o yaml | kubectl apply -f -
  helm upgrade --install "$ESO_RELEASE" external-secrets/external-secrets \
    -n "$ESO_NS" \
    --set installCRDs=true \
    --wait --timeout 5m
else
  echo "ESO release already installed."
fi

kubectl wait --for=condition=Established crd/clustersecretstores.external-secrets.io --timeout=180s
kubectl wait --for=condition=Established crd/externalsecrets.external-secrets.io --timeout=180s
kubectl rollout status deployment/"$ESO_RELEASE" -n "$ESO_NS" --timeout=180s

echo "==> Installing Vault (standalone, persistent)..."
kubectl create namespace "$VAULT_NS" --dry-run=client -o yaml | kubectl apply -f -
if ! helm status "$VAULT_RELEASE" -n "$VAULT_NS" >/dev/null 2>&1; then
  helm upgrade --install "$VAULT_RELEASE" hashicorp/vault \
    -n "$VAULT_NS" \
    -f "$APP_DIR/infrastructure/vault/k8s/vault-values-k3s.yaml" \
    --wait --timeout 10m
else
  echo "Vault release already installed."
fi

echo "==> Waiting for Vault pod Running (Ready sau khi unseal)..."
kubectl wait --for=jsonpath='{.status.phase}'=Running pod/"$VAULT_POD" -n "$VAULT_NS" --timeout=300s

vault_exec() {
  kubectl exec -n "$VAULT_NS" "$VAULT_POD" -- "$@"
}

for _ in $(seq 1 60); do
  if vault_exec vault status -format=json >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

vault_status_json="$(vault_exec vault status -format=json 2>/dev/null || true)"
initialized="$(echo "$vault_status_json" | jq -r '.initialized // false')"

if [[ "$initialized" != "true" ]]; then
  echo "==> Initializing Vault (1 share / 1 threshold)..."
  vault_exec vault operator init -key-shares=1 -key-threshold=1 -format=json > "$INIT_FILE"
  chmod 600 "$INIT_FILE"
  echo "Saved init material to $INIT_FILE (gitignored — back up off-server)."
fi

unseal_key="$(jq -r '.unseal_keys_b64[0]' "$INIT_FILE" | tr -d '\r\n')"
root_token="$(jq -r '.root_token' "$INIT_FILE" | tr -d '\r\n')"

vault_status_json="$(vault_exec vault status -format=json 2>/dev/null || true)"
sealed="$(echo "$vault_status_json" | jq -r 'if (.sealed | type) == "boolean" then .sealed else true end')"
if [[ "$sealed" == "true" ]]; then
  echo "==> Unsealing Vault..."
  vault_exec vault operator unseal "$unseal_key" >/dev/null || true
  vault_status_json="$(vault_exec vault status -format=json 2>/dev/null || true)"
  sealed="$(echo "$vault_status_json" | jq -r 'if (.sealed | type) == "boolean" then .sealed else true end')"
  if [[ "$sealed" == "true" ]]; then
    echo "Vault still sealed after unseal attempt."
    exit 1
  fi
fi

echo "==> Enabling KV v2 at secret/..."
vault_exec sh -c "VAULT_TOKEN='$root_token' vault secrets enable -path=secret kv-v2" >/dev/null 2>&1 || true

echo "==> Installing collabspace-prod-read policy..."
kubectl cp "$APP_DIR/infrastructure/vault/policies/collabspace-prod-read.hcl" \
  "$VAULT_NS/$VAULT_POD:/tmp/collabspace-prod-read.hcl"
vault_exec sh -c "VAULT_TOKEN='$root_token' vault policy write collabspace-prod-read /tmp/collabspace-prod-read.hcl"

if [[ ! -f "$ESO_TOKEN_FILE" ]]; then
  echo "==> Creating ESO read token..."
  vault_exec sh -c "VAULT_TOKEN='$root_token' vault token create -policy=collabspace-prod-read -period=720h -format=json" \
    > "$ESO_TOKEN_FILE"
  chmod 600 "$ESO_TOKEN_FILE"
fi

eso_token="$(jq -r '.auth.client_token' "$ESO_TOKEN_FILE")"

if [[ -f "$PHASE0_ENV" ]]; then
  echo "==> Seeding Vault from phase0.env..."
  PHASE0_ENV="$PHASE0_ENV" VAULT_INIT_FILE="$INIT_FILE" \
    bash "$APP_DIR/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh"
else
  echo "WARN: $PHASE0_ENV not found — skip seed. Run seed-vault-k3s-from-phase0.sh after creating phase0.env"
fi

kubectl create namespace "$APP_NS" --dry-run=client -o yaml | kubectl apply -f -

echo "==> Creating vault-eso-token secret in $APP_NS..."
kubectl create secret generic vault-eso-token \
  -n "$APP_NS" \
  --from-literal=token="$eso_token" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying ClusterSecretStore + ExternalSecrets (prod)..."
kubectl apply -f "$APP_DIR/infrastructure/vault/k8s/cluster-secret-store.yaml"
kubectl apply -f "$APP_DIR/infrastructure/vault/k8s/external-secrets.prod.yaml"

echo "==> Waiting for ExternalSecrets to sync..."
for es in auth-service user-service workspace-service task-service notification-service; do
  kubectl wait --for=condition=Ready "externalsecret/${es}-secrets" -n "$APP_NS" --timeout=180s
done

echo ""
bash "$APP_DIR/infrastructure/deploy/verify-phase2.sh" || true

echo ""
echo "Phase 2 complete."
echo "  Init/unseal keys: $INIT_FILE (store safely off Droplet)"
echo "  ESO token file:   $ESO_TOKEN_FILE"
echo "Next: Phase 3 — helm upgrade --install collabspace with values-prod.yaml"
