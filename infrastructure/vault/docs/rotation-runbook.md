# Vault Secret Rotation Runbook

This runbook outlines the process for rotating critical credentials (such as `JWT_SECRET` and `SERVICE_JWT_SECRET`) securely without incurring downtime.

## 1. Zero-Downtime Secret Rotation Process

When rotating a JWT signing key, the system must temporarily accept **both** the old and the new token to prevent active sessions from being invalidated instantly (unless that is the intended goal during a breach).

### Step 1: Inject the New Secret (Phase 1)
1. Generate a new cryptographically secure secret.
2. Update the Vault KV store:
   ```bash
   vault kv patch secret/collabspace/backend \
       SERVICE_JWT_SECRET_NEW="<new_secret>"
   ```
3. Update the `auth-service` and `workspace-service` `.env` files (or Helm config) to load both the current and new secret.
   * Modify the verification logic to check `SERVICE_JWT_SECRET_NEW` if verification with `SERVICE_JWT_SECRET` fails.

### Step 2: Swap the Primary Secret (Phase 2)
1. Wait for all caches/pods to sync.
2. Update Vault to make the NEW secret the primary signing key, and move the OLD secret to a fallback variable:
   ```bash
   vault kv put secret/collabspace/backend \
       SERVICE_JWT_SECRET="<new_secret>" \
       SERVICE_JWT_SECRET_OLD="<old_secret>"
   ```
3. Restart pods via a rolling update to apply the new signing key.

### Step 3: Remove the Old Secret (Phase 3)
1. Wait until all tokens signed by the old key have naturally expired (e.g., 24 hours).
2. Remove `SERVICE_JWT_SECRET_OLD` from Vault:
   ```bash
   vault kv patch secret/collabspace/backend \
       SERVICE_JWT_SECRET_OLD=""
   ```
3. Remove the fallback verification code from the services if it was hardcoded, or just let it read the empty fallback env variable safely.

## 2. Emergency Breach Revocation

If a secret is actively compromised and you want to **force log out** everyone:
1. Generate a new secret.
2. Overwrite the primary Vault key:
   ```bash
   vault kv put secret/collabspace/backend SERVICE_JWT_SECRET="<new_secret>"
   ```
3. Immediately restart all backend pods:
   ```bash
   kubectl rollout restart deployment -l app.kubernetes.io/part-of=collabspace
   ```
All existing S2S tokens and user S2S sessions will fail verification immediately.
