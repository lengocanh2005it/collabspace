#!/usr/bin/env bash
# Resolve CollabSpace app image tag for Helm values / rollout.
# Priority: explicit IMAGE_TAG env > git origin/main (or HEAD) > phase0 IMAGE_TAG fallback.
#
# Usage:
#   source infrastructure/deploy/resolve-image-tag.sh
#   echo "$RESOLVED_IMAGE_TAG"
#
# Env:
#   ROOT_DIR              — repo root (default: parent of infrastructure/deploy)
#   IMAGE_TAG             — explicit override (CI / manual deploy)
#   PHASE0_IMAGE_TAG      — value from phase0.env (optional fallback)
#   REFRESH_IMAGE_TAG_FROM_GIT — set to "false" to skip git and use PHASE0_IMAGE_TAG only
set -euo pipefail

_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$_SCRIPT_DIR/../.." && pwd)}"

resolve_image_tag_from_git() {
  if [[ "${REFRESH_IMAGE_TAG_FROM_GIT:-true}" == "false" ]]; then
    return 1
  fi
  if ! command -v git >/dev/null 2>&1; then
    return 1
  fi
  if git -C "$ROOT_DIR" rev-parse --verify origin/main >/dev/null 2>&1; then
    git -C "$ROOT_DIR" rev-parse origin/main
    return 0
  fi
  if git -C "$ROOT_DIR" rev-parse HEAD >/dev/null 2>&1; then
    git -C "$ROOT_DIR" rev-parse HEAD
    return 0
  fi
  return 1
}

explicit_image_tag="${IMAGE_TAG:-}"
phase0_image_tag="${PHASE0_IMAGE_TAG:-}"

if [[ -n "$explicit_image_tag" ]]; then
  RESOLVED_IMAGE_TAG="$explicit_image_tag"
  RESOLVED_IMAGE_TAG_SOURCE="explicit IMAGE_TAG"
elif git_tag="$(resolve_image_tag_from_git)"; then
  RESOLVED_IMAGE_TAG="$git_tag"
  RESOLVED_IMAGE_TAG_SOURCE="git ($(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD))"
elif [[ -n "$phase0_image_tag" ]]; then
  RESOLVED_IMAGE_TAG="$phase0_image_tag"
  RESOLVED_IMAGE_TAG_SOURCE="phase0.env"
else
  echo "Could not resolve IMAGE_TAG (set IMAGE_TAG, phase0.env, or run from a git checkout)." >&2
  exit 1
fi

export RESOLVED_IMAGE_TAG
export RESOLVED_IMAGE_TAG_SOURCE
