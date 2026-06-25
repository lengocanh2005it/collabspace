#!/usr/bin/env bash
set -euo pipefail
PHASE0=/opt/collabspace/infrastructure/deploy/phase0.env
python3 - <<'PY'
from pathlib import Path
import re
p = Path("/opt/collabspace/infrastructure/deploy/phase0.env")
text = p.read_text()
text = re.sub(r"(DO_SPACES_SECRET=[^\n]*?)(SLACK_ALERT_WEBHOOK_URL=)", r"\1\n\2", text)
text = re.sub(r"(DO_SPACES_SECRET=[^\n]*?)(RESEND_API_KEY=)", r"\1\n\2", text)
if not text.endswith("\n"):
    text += "\n"
p.write_text(text)
for k in ["RESEND_API_KEY", "SLACK_ALERT_WEBHOOK_URL", "DO_SPACES_SECRET"]:
    m = re.search(rf"^{k}=(.*)$", text, re.M)
    status = "MISSING/empty" if not (m and m.group(1)) else f"set ({len(m.group(1))} chars)"
    print(f"{k}: {status}")
PY
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
PHASE0_ENV="$PHASE0" bash /opt/collabspace/infrastructure/vault/scripts/seed-vault-k3s-from-phase0.sh
kubectl annotate externalsecret auth-service-secrets -n collabspace "force-sync=$(date +%s)" --overwrite
kubectl get pods -n collabspace -l app=auth-service
