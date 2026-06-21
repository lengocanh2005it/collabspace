#!/usr/bin/env bash
set -euo pipefail
APP_DIR=/opt/collabspace
SYNC=/tmp/collabspace-alert-sync

install -D "$SYNC/external-secret-alertmanager.yaml" "$APP_DIR/infrastructure/vault/k8s/external-secret-alertmanager.yaml"
install -D "$SYNC/seed-vault-k3s-from-phase0.sh" "$APP_DIR/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh"
install -D "$SYNC/alertmanager.yaml" "$APP_DIR/infrastructure/helm/collabspace/templates/observability/alertmanager.yaml"
install -D "$SYNC/alertmanager-secret.yaml" "$APP_DIR/infrastructure/helm/collabspace/templates/observability/alertmanager-secret.yaml"
install -D "$SYNC/values.yaml" "$APP_DIR/infrastructure/helm/collabspace/values.yaml"
install -D "$SYNC/helm-rollout.sh" "$APP_DIR/infrastructure/deploy/helm-rollout.sh"
chmod +x "$APP_DIR/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh" "$APP_DIR/infrastructure/deploy/helm-rollout.sh"
sed -i 's/\r$//' "$APP_DIR/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh"
sed -i 's/\r$//' "$APP_DIR/infrastructure/deploy/helm-rollout.sh"

PHASE0="$APP_DIR/infrastructure/deploy/phase0.env"
python3 - <<'PY'
from pathlib import Path
import re
p = Path("/opt/collabspace/infrastructure/deploy/phase0.env")
text = p.read_text()
text = re.sub(r"(DO_SPACES_SECRET=[^\n]*?)SLACK_ALERT_WEBHOOK_URL=.*", r"\1\n", text)
text = re.sub(r"^SLACK_ALERT_WEBHOOK_URL=.*\n?", "", text, flags=re.M)
if not text.endswith("\n"):
    text += "\n"
p.write_text(text)
PY
if ! grep -q '^SLACK_ALERT_WEBHOOK_URL=' "$PHASE0" 2>/dev/null; then
  echo 'SLACK_ALERT_WEBHOOK_URL=' >> "$PHASE0"
fi
: "${SLACK_ALERT_WEBHOOK_URL:?Set SLACK_ALERT_WEBHOOK_URL}"
sed -i "s|^SLACK_ALERT_WEBHOOK_URL=.*|SLACK_ALERT_WEBHOOK_URL=${SLACK_ALERT_WEBHOOK_URL}|" "$PHASE0"

VALUES_PROD="$APP_DIR/infrastructure/helm/collabspace/values-prod.yaml"
if ! grep -q 'slack:' "$VALUES_PROD" 2>/dev/null; then
  python3 - <<'PY'
import pathlib, re
p = pathlib.Path("/opt/collabspace/infrastructure/helm/collabspace/values-prod.yaml")
text = p.read_text()
block = """  alertmanager:
    slack:
      enabled: true
      channel: \"#nouveau-canal\"
      webhookUrl: \"\"
"""
text = re.sub(r"(^\s*exporters:\s*\n\s*enabled: true\s*\n)", r"\1" + block, text, count=1, flags=re.M)
p.write_text(text)
PY
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
echo "==> Seeding Vault with Slack webhook..."
PHASE0_ENV="$PHASE0" bash "$APP_DIR/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh"

echo "==> Applying ExternalSecret alertmanager-slack-secret..."
kubectl apply -f "$APP_DIR/infrastructure/vault/k8s/external-secret-alertmanager.yaml"
kubectl wait --for=condition=Ready externalsecret/alertmanager-slack-secret -n collabspace --timeout=120s

echo "==> Helm upgrade (alertmanager slack)..."
export APP_DIR
bash "$APP_DIR/infrastructure/deploy/helm-rollout.sh"

echo "==> Waiting for alertmanager rollout..."
kubectl rollout status deployment/alertmanager -n collabspace --timeout=180s

echo "==> Fire test alert to Alertmanager..."
kubectl exec -n collabspace deploy/alertmanager -- wget -qO- \
  --post-data='[{"labels":{"alertname":"CollabSpaceTestAlert","severity":"critical","job":"collabspace-ops"},"annotations":{"summary":"CollabSpace Alertmanager test","description":"Test fire alert after Slack webhook wiring (#15)."}}]' \
  --header='Content-Type: application/json' \
  http://127.0.0.1:9093/api/v2/alerts || true

kubectl get pods -n collabspace -l app=alertmanager
kubectl get externalsecret alertmanager-slack-secret -n collabspace
