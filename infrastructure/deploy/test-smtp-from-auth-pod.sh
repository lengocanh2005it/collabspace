#!/usr/bin/env bash
# Quick SMTP connectivity + credential sanity check from auth-service pod.
set -euo pipefail
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"

echo "==> SMTP port 587 from auth-service pod..."
kubectl exec -n "$APP_NS" deploy/auth-service -- sh -c 'command -v nc >/dev/null && nc -zv -w5 smtp.gmail.com 587 || (timeout 5 sh -c "echo >/dev/tcp/smtp.gmail.com/587" && echo "tcp/587 open")' 2>&1 || echo "SMTP port check failed"

echo "==> MAIL_* env (password length only)..."
kubectl exec -n "$APP_NS" deploy/auth-service -- sh -c 'echo MAIL_USER=$MAIL_USER; echo MAIL_FROM=$MAIL_FROM; echo MAIL_PASSWORD_LEN=${#MAIL_PASSWORD}'
