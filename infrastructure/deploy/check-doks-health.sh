#!/usr/bin/env bash
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"

echo "=== Deployments (ready/desired) ==="
kubectl get deploy -n "$APP_NS" -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,DESIRED:.spec.replicas,AVAILABLE:.status.availableReplicas 2>/dev/null | grep -E 'NAME|auth|user|workspace|task|notification|traefik'

echo
echo "=== App pods not Running/Completed ==="
kubectl get pods -n "$APP_NS" --no-headers | grep -vE 'Running|Completed' || echo "(all app pods OK)"

echo
echo "=== Health via gateway (Traefik) ==="
BASE="http://127.0.0.1/api/v1"
for svc_path in "auth:auth" "users:user" "workspaces:workspace" "tasks:task" "notifications:notification"; do
  svc="${svc_path%%:*}"
  url="${BASE}/${svc}/health/ready"
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "err")
  echo "  ${svc_path#*:} (${svc}): HTTP ${code}"
done

echo
echo "=== Public IP (167.172.77.110) ==="
PUB="http://167.172.77.110/api/v1"
for svc in auth users workspaces tasks notifications; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${PUB}/${svc}/health/ready" 2>/dev/null || echo "err")
  echo "  ${svc}: HTTP ${code}"
done

echo
echo "=== Infra pods ==="
kubectl get pods -n "$APP_NS" --no-headers | grep -E 'postgres|mongo|redis|rabbit' || true

echo
echo "=== Auth Resend env (no secrets) ==="
kubectl exec -n "$APP_NS" deploy/auth-service -- printenv RESEND_SENDER_EMAIL RESEND_SENDER_NAME 2>/dev/null || echo "auth pod unavailable"
kubectl exec -n "$APP_NS" deploy/auth-service -- sh -c 'test -n "$RESEND_API_KEY" && echo RESEND_API_KEY=present || echo RESEND_API_KEY=missing' 2>/dev/null

echo
echo "=== Recent restarts (app deployments) ==="
kubectl get pods -n "$APP_NS" -l 'app.kubernetes.io/name in (auth-service,user-service,workspace-service,task-service,notification-service)' -o custom-columns=NAME:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount,STATUS:.status.phase 2>/dev/null
