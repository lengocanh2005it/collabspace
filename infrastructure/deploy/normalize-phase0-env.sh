#!/usr/bin/env bash
# Normalize phase0.env line breaks + ensure PROD_DOMAIN is hostname (not IP).
set -euo pipefail
PHASE0="${1:-/opt/collabspace/infrastructure/deploy/phase0.env}"
python3 - <<PY
from pathlib import Path
import re
p = Path("$PHASE0")
text = p.read_text()
text = re.sub(r"(DO_SPACES_SECRET=[^\n]*?)(SLACK_ALERT_WEBHOOK_URL=)", r"\1\n\2", text)
text = re.sub(r"(DO_SPACES_SECRET=[^\n]*?)(BREVO_API_KEY=)", r"\1\n\2", text)
text = re.sub(r"^PROD_DOMAIN=167\.172\.77\.110\s*$", "PROD_DOMAIN=collabspace.ngocanh2005it.site", text, flags=re.M)
if not text.endswith("\n"):
    text += "\n"
p.write_text(text)
print("phase0.env normalized")
PY
