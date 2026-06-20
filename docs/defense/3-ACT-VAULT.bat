@echo off
color 0B
echo =======================================================
echo     ACT 3: ZERO-SECRET PROOF (HASHICORP VAULT ESO)
echo =======================================================
echo.
echo Fetching External Secrets Operator status from Kubernetes...
ssh root@167.172.77.110 "kubectl get externalsecrets -n collabspace"
echo.
echo Notice how the robot automatically syncs everything from Vault.
echo Zero passwords in the source code.
pause
