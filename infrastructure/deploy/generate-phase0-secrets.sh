#!/usr/bin/env bash
# Sinh secret ngẫu nhiên + phase0.env (IP Droplet, không cần domain).
#   ./infrastructure/deploy/generate-phase0-secrets.sh 165.x.x.x
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <DROPLET_IP> [GHCR_OWNER]"
  exit 1
fi

DROPLET_IP="$1"
GHCR_OWNER="${2:-lengocanh2005it}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_FILE="$SCRIPT_DIR/phase0.env"

rand_b64() { openssl rand -base64 32; }
rand_hex() { openssl rand -hex 16; }

IMAGE_TAG="$(git -C "$ROOT_DIR" rev-parse origin/main 2>/dev/null || git -C "$ROOT_DIR" rev-parse HEAD)"

cat >"$OUT_FILE" <<EOF
# Generated $(date -Iseconds) — KHÔNG commit file này

DROPLET_HOST=${DROPLET_IP}
DROPLET_SSH_USER=root
PROD_DOMAIN=${DROPLET_IP}

GHCR_OWNER=${GHCR_OWNER}
IMAGE_TAG=${IMAGE_TAG}
GHCR_USERNAME=${GHCR_OWNER}
GHCR_TOKEN=

JWT_SECRET=$(rand_b64)
SERVICE_JWT_SECRET=$(rand_b64)
POSTGRES_PASSWORD=$(rand_b64)
MONGO_PASSWORD=$(rand_b64)
REDIS_PASSWORD=$(rand_b64)
RABBITMQ_PASSWORD=$(rand_b64)
RABBITMQ_USERNAME=collabspace
METRICS_AUTH_TOKEN=$(rand_b64)
RABBITMQ_ERLANG_COOKIE=$(rand_hex)

# --- Brevo (auth-service) ---
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME="CollabSpace Platform"

# --- Azure Blob ---
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER_NAME=task-attachments
AZURE_STORAGE_MAX_FILE_SIZE=5242880

# --- DigitalOcean Spaces (backup CronJob) ---
DO_SPACES_KEY=
DO_SPACES_SECRET=

# --- Slack alerts ---
SLACK_ALERT_WEBHOOK_URL=

# Kafka migration extraEnv: see phase0.env.example (values-prod.yaml, not Vault)
EOF

chmod 600 "$OUT_FILE"
echo "Wrote $OUT_FILE"
echo "IMAGE_TAG=$IMAGE_TAG"
echo "Next: ./infrastructure/deploy/prepare-prod-values.sh"
