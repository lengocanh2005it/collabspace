#!/usr/bin/env bash
# Clone hoac git pull repo private tren Droplet (can PAT trong phase0.env).
#
#   PHASE0_ENV=/opt/collabspace/infrastructure/deploy/phase0.env \
#   GIT_BRANCH=main \
#   bash infrastructure/deploy/git-sync-private-repo.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/collabspace}"
PHASE0_ENV="${PHASE0_ENV:-$APP_DIR/infrastructure/deploy/phase0.env}"
GIT_BRANCH="${GIT_BRANCH:-main}"
GITHUB_REPO="${GITHUB_REPO:-collabspace}"

if [[ -f "$PHASE0_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PHASE0_ENV"
  set +a
fi

OWNER="${GHCR_OWNER:-lengocanh2005it}"
TOKEN="${GITHUB_TOKEN:-${GHCR_TOKEN:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "Need GITHUB_TOKEN or GHCR_TOKEN in $PHASE0_ENV (PAT: repo + read:packages)."
  exit 1
fi

CRED_FILE="${HOME}/.collabspace-git-credentials"
printf 'https://x-access-token:%s@github.com\n' "$TOKEN" > "$CRED_FILE"
chmod 600 "$CRED_FILE"
git config --global credential.helper "store --file=$CRED_FILE"

REPO_URL="https://github.com/${OWNER}/${GITHUB_REPO}.git"
mkdir -p "$(dirname "$APP_DIR")"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "==> git clone -b ${GIT_BRANCH} ${REPO_URL}"
  git clone -b "$GIT_BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "==> git pull ${GIT_BRANCH} in ${APP_DIR}"
  cd "$APP_DIR"
  git fetch origin "$GIT_BRANCH"
  git checkout "$GIT_BRANCH"
  # Droplet may have hotfixed files from scp; deploy server should match origin exactly.
  git reset --hard "origin/${GIT_BRANCH}"
fi

echo "Repo synced at $APP_DIR ($(git -C "$APP_DIR" rev-parse --short HEAD))"
