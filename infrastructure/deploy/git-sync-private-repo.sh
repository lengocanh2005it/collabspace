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

# Documenting --global requirement for the team:
# We MUST use --global here because Git strictly refuses to even open the 
# repository's --local config if it detects dubious ownership.
git config --global --add safe.directory "$APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "==> Safe initialization in existing directory: $APP_DIR"
  mkdir -p "$APP_DIR" && cd "$APP_DIR"
  git init
  # Force HTTPS remote to guarantee credential.helper is used instead of SSH
  git remote add origin "$REPO_URL"
  git fetch origin "$GIT_BRANCH"
  git reset --hard "origin/${GIT_BRANCH}"
else
  echo "==> git pull ${GIT_BRANCH} in ${APP_DIR}"
  cd "$APP_DIR"
  # Force HTTPS remote to overwrite any legacy SSH remotes
  git remote set-url origin "$REPO_URL"
  git fetch origin "$GIT_BRANCH"
  git checkout "$GIT_BRANCH" || git checkout -b "$GIT_BRANCH" --track "origin/${GIT_BRANCH}"
  # Droplet may have hotfixed files from scp; deploy server should match origin exactly.
  git reset --hard "origin/${GIT_BRANCH}"
fi

echo "Repo synced at $APP_DIR ($(git -C "$APP_DIR" rev-parse --short HEAD))"
