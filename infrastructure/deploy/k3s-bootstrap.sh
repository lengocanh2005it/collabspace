#!/usr/bin/env bash
# Phase 1 — Bootstrap k3s single-node trên DigitalOcean Droplet.
# Chạy trên Droplet với quyền root:
#   curl -fsSL .../k3s-bootstrap.sh | bash -s -- https://github.com/owner/collabspace.git
# hoặc sau khi clone repo:
#   sudo bash infrastructure/deploy/k3s-bootstrap.sh
set -euo pipefail

REPO_URL="${1:-}"
APP_DIR="${APP_DIR:-/opt/collabspace}"
K3S_CHANNEL="${K3S_CHANNEL:-stable}"
HELM_VERSION="${HELM_VERSION:-v3.16.4}"
NAMESPACE="${NAMESPACE:-collabspace}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root on the Droplet (e.g. sudo bash $0)."
  exit 1
fi

echo "==> Phase 1: k3s bootstrap (CollabSpace)"

echo "==> Installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates git jq ufw

echo "==> Configuring UFW (22, 80, 443)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [[ -n "$REPO_URL" ]]; then
  echo "==> Cloning repository to ${APP_DIR}..."
  mkdir -p "$(dirname "$APP_DIR")"
  if [[ ! -d "$APP_DIR/.git" ]]; then
    git clone "$REPO_URL" "$APP_DIR"
  else
    echo "Repo already exists at $APP_DIR — skip clone."
  fi
fi

if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git pull --ff-only || echo "Warning: git pull failed; continuing with existing tree."
else
  echo "Warning: ${APP_DIR} not found. Clone repo manually before helm dependency update."
fi

if ! command -v k3s >/dev/null 2>&1; then
  echo "==> Installing k3s (Traefik built-in disabled)..."
  curl -sfL https://get.k3s.io | INSTALL_K3S_CHANNEL="${K3S_CHANNEL}" sh -s - \
    --disable traefik \
    --write-kubeconfig-mode 644
else
  echo "k3s already installed — skip install."
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl cluster-info

echo "==> Waiting for node Ready..."
kubectl wait --for=condition=Ready node --all --timeout=180s

echo "==> Ensuring namespace ${NAMESPACE}..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

echo "==> Storage classes:"
kubectl get storageclass

if ! command -v helm >/dev/null 2>&1; then
  echo "==> Installing Helm ${HELM_VERSION}..."
  curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz" | tar -xz -C /tmp
  install -m 0755 "/tmp/linux-amd64/helm" /usr/local/bin/helm
  rm -rf /tmp/linux-amd64
fi

helm version

if [[ -f "$APP_DIR/infrastructure/helm/collabspace/Chart.yaml" ]]; then
  echo "==> Updating Helm chart dependencies..."
  helm dependency update "$APP_DIR/infrastructure/helm/collabspace"
else
  echo "Skip helm dependency update — chart not found at $APP_DIR/infrastructure/helm/collabspace"
fi

echo ""
echo "Phase 1 bootstrap complete."
echo ""
echo "Verify:"
echo "  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
echo "  kubectl get nodes"
echo "  kubectl get ns ${NAMESPACE}"
echo ""
echo "From your laptop (optional kubeconfig):"
echo "  scp root@<DROPLET_IP>:/etc/rancher/k3s/k3s.yaml ~/.kube/collabspace-prod.yaml"
echo "  # Replace 127.0.0.1 with Droplet IP in that file"
echo ""
echo "Next: Phase 2 — Vault + ESO (docs/deployment-k3s-phases.md)"
