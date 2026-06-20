#!/usr/bin/env bash
# Tạo values-prod.yaml từ values-prod.example.yaml + phase0.env (Phase 0).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HELM_DIR="$ROOT_DIR/infrastructure/helm/collabspace"
ENV_FILE="$SCRIPT_DIR/phase0.env"
EXAMPLE="$HELM_DIR/values-prod.example.yaml"
OUTPUT="$HELM_DIR/values-prod.yaml"
RESOLVE_TAG_SCRIPT="$SCRIPT_DIR/resolve-image-tag.sh"

if [[ ! -f "$EXAMPLE" ]]; then
  echo "Missing $EXAMPLE"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Create $ENV_FILE from phase0.env.example first:"
  echo "  cp infrastructure/deploy/phase0.env.example infrastructure/deploy/phase0.env"
  exit 1
fi

caller_image_tag="${IMAGE_TAG:-}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

phase0_image_tag="${IMAGE_TAG:-}"
PHASE0_IMAGE_TAG="$phase0_image_tag"
if [[ -n "$caller_image_tag" ]]; then
  IMAGE_TAG="$caller_image_tag"
fi

# shellcheck disable=SC1090
source "$RESOLVE_TAG_SCRIPT"
IMAGE_TAG="$RESOLVED_IMAGE_TAG"

if [[ "$IMAGE_TAG" != "$phase0_image_tag" ]]; then
  echo "IMAGE_TAG: ${phase0_image_tag:-<empty>} -> ${IMAGE_TAG} (${RESOLVED_IMAGE_TAG_SOURCE})"
  if [[ "${SKIP_PHASE0_IMAGE_TAG_SYNC:-}" != "1" ]] && grep -q '^IMAGE_TAG=' "$ENV_FILE"; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" "$ENV_FILE"
    echo "Synced IMAGE_TAG into $ENV_FILE"
  fi
fi

required=(
  GHCR_OWNER
  IMAGE_TAG
  JWT_SECRET
  SERVICE_JWT_SECRET
  POSTGRES_PASSWORD
  MONGO_PASSWORD
  REDIS_PASSWORD
  METRICS_AUTH_TOKEN
  PROD_DOMAIN
  AZURE_STORAGE_CONNECTION_STRING
  BREVO_SENDER_EMAIL
  BREVO_SENDER_NAME
)

missing=()
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    missing+=("$key")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required variables in $ENV_FILE:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

python3 - "$EXAMPLE" "$OUTPUT" <<'PY'
import os
import sys

src, dst = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()

replacements = {
    "REPLACE_ME_GHCR_OWNER": os.environ["GHCR_OWNER"],
    "REPLACE_ME_IMAGE_TAG": os.environ["IMAGE_TAG"],
    "REPLACE_ME_DOMAIN": os.environ["PROD_DOMAIN"],
    "REPLACE_ME_ACME_EMAIL": os.environ.get("ACME_EMAIL") or os.environ.get("BREVO_SENDER_EMAIL", "admin@example.com"),
    'jwtSecret: "REPLACE_ME"': f'jwtSecret: "{os.environ["JWT_SECRET"]}"',
    'serviceJwtSecret: "REPLACE_ME"': f'serviceJwtSecret: "{os.environ["SERVICE_JWT_SECRET"]}"',
    'postgresPassword: "REPLACE_ME"': f'postgresPassword: "{os.environ["POSTGRES_PASSWORD"]}"',
    'mongoPassword: "REPLACE_ME"': f'mongoPassword: "{os.environ["MONGO_PASSWORD"]}"',
    'redisPassword: "REPLACE_ME"': f'redisPassword: "{os.environ["REDIS_PASSWORD"]}"',
    'metricsAuthToken: "REPLACE_ME"': f'metricsAuthToken: "{os.environ["METRICS_AUTH_TOKEN"]}"',
    'azureStorageConnectionString: "REPLACE_ME_AZURE"': f'azureStorageConnectionString: "{os.environ["AZURE_STORAGE_CONNECTION_STRING"]}"',
    'rootPassword: "REPLACE_ME"': f'rootPassword: "{os.environ["MONGO_PASSWORD"]}"',
    "BREVO_SENDER_EMAIL: REPLACE_ME_BREVO_SENDER_EMAIL": f'BREVO_SENDER_EMAIL: "{os.environ.get("BREVO_SENDER_EMAIL", "")}"',
    "BREVO_SENDER_NAME: REPLACE_ME_BREVO_SENDER_NAME": f'BREVO_SENDER_NAME: "{os.environ.get("BREVO_SENDER_NAME", "CollabSpace")}"',
}

for old, new in replacements.items():
    text = text.replace(old, new)

# Bitnami postgres auth.password (sau postgresPassword đã thay)
text = text.replace(
    'password: "REPLACE_ME"',
    f'password: "{os.environ["POSTGRES_PASSWORD"]}"',
    1,
)
# Redis master password
text = text.replace(
    'password: "REPLACE_ME"',
    f'password: "{os.environ["REDIS_PASSWORD"]}"',
    1,
)

open(dst, "w", encoding="utf-8", newline="\n").write(text)
PY

echo "Wrote $OUTPUT"
echo "Next: seed Vault secret/collabspace/prod with the same values, then Phase 1 (k3s bootstrap)."
