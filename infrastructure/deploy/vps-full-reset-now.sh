#!/usr/bin/env bash
# VPS helper — delegates to run-k8s-full-reset (stops apps → wipe → migrate → seed → restore).
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_DIR="${APP_DIR:-/opt/collabspace}"
exec bash "$APP_DIR/infrastructure/deploy/run-k8s-full-reset.sh"
