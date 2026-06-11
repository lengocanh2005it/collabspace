#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${SCRIPT_DIR}/../collabspace"
RELEASE_NAME="${RELEASE_NAME:-collabspace}"
NAMESPACE="${NAMESPACE:-collabspace}"
LOCAL=false

usage() {
  echo "Usage: $0 [--local] [--release NAME] [--namespace NS]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) LOCAL=true; shift ;;
    --release) RELEASE_NAME="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if ! command -v helm >/dev/null 2>&1; then
  echo "Helm is not installed. See infrastructure/helm/README.md"
  exit 1
fi

echo "Updating Helm dependencies..."
helm dependency update "${CHART_DIR}"

EXTRA_VALUES=()
if [[ "${LOCAL}" == "true" ]]; then
  EXTRA_VALUES+=(-f "${CHART_DIR}/values-local.yaml")
fi

echo "Installing release '${RELEASE_NAME}' into namespace '${NAMESPACE}'..."
helm upgrade --install "${RELEASE_NAME}" "${CHART_DIR}" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  -f "${CHART_DIR}/values.yaml" \
  "${EXTRA_VALUES[@]}"

kubectl get pods -n "${NAMESPACE}"
kubectl get svc traefik -n "${NAMESPACE}" 2>/dev/null || true

echo "Done. See infrastructure/helm/README.md for next steps."
