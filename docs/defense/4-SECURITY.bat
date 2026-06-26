@echo off
SET KUBECONFIG=d:\Code\team\collabspace-doks-1-kubeconfig.yaml
color 0E
cls
echo ============================================================
echo   ACT 3 — SECURITY: ZERO-TRUST
echo   22 NetworkPolicies + 9 Vault Secrets
echo ============================================================
echo.
echo --- Network Security: 22 Policies, Default-Deny ---
kubectl get networkpolicies -n collabspace
echo.
echo --- Secrets: All Synced from HashiCorp Vault ---
kubectl get externalsecrets -n collabspace
echo.
echo ============================================================
echo   SAY: "Every pod blocked by default. These 22 policies
echo   are surgical whitelists. And not a single password in
echo   code — 9 credentials from Vault, injected at runtime."
echo ============================================================
pause
