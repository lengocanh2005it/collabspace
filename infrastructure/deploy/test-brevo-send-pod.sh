#!/usr/bin/env bash
# Direct Brevo send test from auth-service pod (uses pod env BREVO_API_KEY).
set -euo pipefail
TO="${1:?usage: $0 <to-email>}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"

kubectl exec -n "$APP_NS" deploy/auth-service -- env TO="$TO" node -e '
const { BrevoClient } = require("@getbrevo/brevo");
const apiKey = process.env.BREVO_API_KEY;
const to = process.env.TO;
const sender = { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME };
if (!apiKey) { console.error("NO_API_KEY"); process.exit(1); }
const client = new BrevoClient({ apiKey });
const timeout = setTimeout(() => { console.error("TIMEOUT after 20s"); process.exit(2); }, 20000);
client.transactionalEmails.sendTransacEmail({
  sender,
  to: [{ email: to }],
  subject: "CollabSpace Brevo test",
  textContent: "If you receive this, Brevo delivery works from the cluster.",
}).then((r) => {
  clearTimeout(timeout);
  console.log("OK", JSON.stringify(r));
}).catch((e) => {
  clearTimeout(timeout);
  console.error("ERR", e && e.message ? e.message : String(e));
  process.exit(3);
});
'
