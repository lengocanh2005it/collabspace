#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-}"
APP_DIR="${APP_DIR:-/opt/collabspace}"

if [[ -z "$REPO_URL" ]]; then
  echo "Usage: $0 <git-repository-url>"
  echo "Example: $0 https://github.com/owner/collabspace.git"
  exit 1
fi

apt-get update
apt-get upgrade -y
apt-get install -y git curl ufw ca-certificates jq python3

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f infrastructure/deploy/droplet.env ]]; then
  cp infrastructure/deploy/droplet.env.example infrastructure/deploy/droplet.env
  echo "Created infrastructure/deploy/droplet.env. Edit it before first deploy."
fi

echo "Bootstrap complete."
echo "Next:"
echo "  1. Configure Vault or copy service .env files manually."
echo "  2. Edit infrastructure/deploy/droplet.env."
echo "  3. Run: ./infrastructure/deploy/droplet-deploy.sh"
