#!/usr/bin/env bash
# Direct Resend send test from auth-service pod (uses pod env RESEND_API_KEY).
set -euo pipefail
TO="${1:?usage: $0 <to-email>}"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
APP_NS="${APP_NS:-collabspace}"

kubectl exec -n "$APP_NS" deploy/auth-service -- env TO="$TO" node -e '
const { Resend } = require("resend");
const apiKey = process.env.RESEND_API_KEY;
const to = process.env.TO;
const senderEmail = process.env.RESEND_SENDER_EMAIL;
const senderName = process.env.RESEND_SENDER_NAME || "CollabSpace";
if (!apiKey) { console.error("NO_API_KEY"); process.exit(1); }
if (!senderEmail) { console.error("NO_SENDER_EMAIL"); process.exit(1); }
const client = new Resend(apiKey);
const timeout = setTimeout(() => { console.error("TIMEOUT after 20s"); process.exit(2); }, 20000);
client.emails.send({
  from: `${senderName} <${senderEmail}>`,
  to,
  subject: "CollabSpace Resend test",
  text: "If you receive this, Resend delivery works from the cluster.",
}).then((r) => {
  clearTimeout(timeout);
  console.log("OK", JSON.stringify(r));
}).catch((e) => {
  clearTimeout(timeout);
  console.error("ERR", e && e.message ? e.message : String(e));
  process.exit(3);
});
'
